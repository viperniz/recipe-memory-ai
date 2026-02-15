// Video Memory AI — Chrome Extension Service Worker

const DEFAULT_API_BASE = 'http://localhost:8000';
const DEFAULT_WEBAPP_BASE = 'http://localhost:3000';

// --- Storage helpers ---

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

async function getToken() {
  const { token } = await getStorage('token');
  return token || null;
}

async function getApiBase() {
  const { apiBase } = await getStorage('apiBase');
  return apiBase || DEFAULT_API_BASE;
}

async function getWebappBase() {
  const { webappBase } = await getStorage('webappBase');
  return webappBase || DEFAULT_WEBAPP_BASE;
}

// --- API helpers ---

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const apiBase = await getApiBase();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired or invalid — clear auth state
    await setStorage({ token: null, user: null });
    notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: false });
    return { error: 'unauthorized', status: 401 };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Backend sends structured 403 errors as body.detail = { error, feature, ... }
    const detail = body.detail || {};
    const errorType = (typeof detail === 'object' && detail.error) ? detail.error : (body.error_type || null);
    const errorMsg = (typeof detail === 'object' && detail.message) ? detail.message : (typeof detail === 'string' ? detail : `Request failed (${response.status})`);
    return {
      error: errorMsg,
      error_type: errorType,
      status: response.status
    };
  }

  return response.json();
}

// --- Tab messaging ---

function notifyAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  });
}

// --- Saved URLs cache ---

async function getSavedUrls() {
  const { savedUrls } = await getStorage('savedUrls');
  return savedUrls || [];
}

async function addSavedUrl(url) {
  const urls = await getSavedUrls();
  if (!urls.includes(url)) {
    urls.push(url);
    // Keep last 500 URLs
    if (urls.length > 500) urls.shift();
    await setStorage({ savedUrls: urls });
  }
}

// --- Message handlers ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {

    case 'GET_AUTH_STATUS': {
      const { token, user } = await getStorage(['token', 'user']);
      return { isLoggedIn: !!token, user: user || null };
    }

    case 'SET_TOKEN': {
      await setStorage({
        token: message.token,
        user: message.user || null
      });
      notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: true, user: message.user });
      return { success: true };
    }

    case 'LOGOUT': {
      await setStorage({ token: null, user: null });
      notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: false });
      return { success: true };
    }

    case 'SAVE_VIDEO': {
      // 1. Tier check: free users cannot save YouTube videos
      const credits = await apiFetch('/api/billing/credits');
      if (credits.error) {
        return credits;
      }
      if (credits.tier === 'free') {
        return {
          error: 'YouTube downloads require a Starter+ plan. Free users can upload local files on the web app.',
          error_type: 'feature_locked',
          status: 403
        };
      }

      // 2. Extract YouTube cookies from browser
      let cookiesStr = null;
      try {
        const ytCookies = await chrome.cookies.getAll({ domain: '.youtube.com' });
        if (ytCookies && ytCookies.length > 0) {
          const lines = ['# Netscape HTTP Cookie File'];
          for (const c of ytCookies) {
            const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
            const flag = 'TRUE';
            const path = c.path || '/';
            const secure = c.secure ? 'TRUE' : 'FALSE';
            const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0;
            lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expiry}\t${c.name}\t${c.value}`);
          }
          cookiesStr = lines.join('\n');
        }
      } catch (e) {
        console.warn('Cookie extraction failed:', e);
      }

      // 3. Send to backend with cookies
      const result = await apiFetch('/api/videos/add', {
        method: 'POST',
        body: JSON.stringify({
          url_or_path: message.url,
          analyze_frames: message.analyzeFrames ?? false,
          cookies: cookiesStr
        })
      });
      if (!result.error && result.job) {
        addSavedUrl(message.url);
      }
      return result;
    }

    case 'GET_JOB_STATUS': {
      return apiFetch(`/api/jobs/${message.jobId}`);
    }

    case 'GET_CREDITS': {
      return apiFetch('/api/billing/credits');
    }

    case 'CHECK_SAVED': {
      const urls = await getSavedUrls();
      return { saved: urls.includes(message.url) };
    }

    case 'GET_SETTINGS': {
      const data = await getStorage(['apiBase', 'webappBase', 'defaultAnalyzeFrames']);
      return {
        apiBase: data.apiBase || DEFAULT_API_BASE,
        webappBase: data.webappBase || DEFAULT_WEBAPP_BASE,
        defaultAnalyzeFrames: data.defaultAnalyzeFrames ?? false
      };
    }

    case 'SAVE_SETTINGS': {
      const updates = {};
      if (message.apiBase !== undefined) updates.apiBase = message.apiBase;
      if (message.webappBase !== undefined) updates.webappBase = message.webappBase;
      if (message.defaultAnalyzeFrames !== undefined) updates.defaultAnalyzeFrames = message.defaultAnalyzeFrames;
      await setStorage(updates);
      return { success: true };
    }

    case 'GET_WEBAPP_BASE': {
      return { webappBase: await getWebappBase() };
    }

    case 'GET_RECENT_SAVES': {
      const urls = await getSavedUrls();
      return { urls: urls.slice(-3).reverse() };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}
