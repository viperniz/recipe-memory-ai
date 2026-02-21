// Video Memory AI — Chrome Extension Service Worker

const DEFAULT_API_BASE = 'https://recipe-memory-api.onrender.com';
const DEFAULT_WEBAPP_BASE = 'https://recipe-memory-ai.vercel.app';

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

// --- Token refresh ---

let refreshPromise = null; // Deduplicates concurrent refresh calls

async function refreshToken() {
  const token = await getToken();
  if (!token) return null;

  const apiBase = await getApiBase();
  try {
    const response = await fetch(`${apiBase}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.access_token) {
      const expiresAt = Date.now() + (data.expires_in || 2592000) * 1000;
      await setStorage({
        token: data.access_token,
        user: data.user || null,
        tokenExpiresAt: expiresAt
      });
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureValidToken() {
  const { token, tokenExpiresAt } = await getStorage(['token', 'tokenExpiresAt']);
  if (!token) return;

  // Refresh if token expires within 3 days
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  if (tokenExpiresAt && tokenExpiresAt - Date.now() < THREE_DAYS_MS) {
    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
  }
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

async function apiFetch(path, options = {}, _retried = false) {
  // Proactively refresh token if close to expiry
  await ensureValidToken();

  const token = await getToken();
  const apiBase = await getApiBase();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers
    });
  } catch (e) {
    return { error: 'Cannot reach Video Memory AI servers', error_type: 'network_error', status: 0 };
  }

  if (response.status === 401 && !_retried) {
    // Try one refresh before giving up
    const refreshed = await refreshToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
    await setStorage({ token: null, user: null, tokenExpiresAt: null });
    notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: false });
    return { error: 'unauthorized', error_type: 'unauthorized', status: 401 };
  }

  if (response.status === 401) {
    await setStorage({ token: null, user: null, tokenExpiresAt: null });
    notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: false });
    return { error: 'unauthorized', error_type: 'unauthorized', status: 401 };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
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

// --- Saved videos cache (rich objects instead of plain URLs) ---

async function getSavedVideos() {
  const { savedVideos, savedUrls } = await getStorage(['savedVideos', 'savedUrls']);
  if (savedVideos) return savedVideos;
  // Migrate legacy plain URL array to rich format
  if (savedUrls && savedUrls.length > 0) {
    const migrated = savedUrls.map(url => {
      const videoId = extractVideoId(url);
      return { url, videoId, title: null, savedAt: Date.now() };
    });
    await setStorage({ savedVideos: migrated });
    return migrated;
  }
  return [];
}

async function addSavedVideo(url, title = null) {
  const videos = await getSavedVideos();
  if (videos.some(v => v.url === url)) return;

  const videoId = extractVideoId(url);
  videos.push({
    url,
    videoId,
    title: title || null,
    savedAt: Date.now()
  });
  // Keep last 500
  if (videos.length > 500) videos.shift();
  await setStorage({ savedVideos: videos });

  // Also maintain legacy savedUrls for CHECK_SAVED compatibility
  const { savedUrls } = await getStorage('savedUrls');
  const urls = savedUrls || [];
  if (!urls.includes(url)) {
    urls.push(url);
    if (urls.length > 500) urls.shift();
    await setStorage({ savedUrls: urls });
  }
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || null;
  } catch {
    return null;
  }
}

// --- YouTube cookie helpers ---

async function formatYouTubeCookies() {
  try {
    const ytCookies = await chrome.cookies.getAll({ domain: '.youtube.com' });
    if (!ytCookies || ytCookies.length === 0) return null;
    const lines = ['# Netscape HTTP Cookie File'];
    for (const c of ytCookies) {
      const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
      const flag = 'TRUE';
      const path = c.path || '/';
      const secure = c.secure ? 'TRUE' : 'FALSE';
      const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0;
      lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expiry}\t${c.name}\t${c.value}`);
    }
    return lines.join('\n');
  } catch (e) {
    console.warn('Cookie extraction failed:', e);
    return null;
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
      const expiresAt = message.expiresIn
        ? Date.now() + message.expiresIn * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000; // default 30 days
      await setStorage({
        token: message.token,
        user: message.user || null,
        tokenExpiresAt: expiresAt
      });
      notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: true, user: message.user });
      return { success: true };
    }

    case 'LOGOUT': {
      await setStorage({ token: null, user: null, tokenExpiresAt: null });
      notifyAllTabs({ type: 'VMEM_AUTH_CHANGED', isLoggedIn: false });
      return { success: true };
    }

    case 'GET_YOUTUBE_COOKIES': {
      const cookies = await formatYouTubeCookies();
      return { cookies };
    }

    case 'SAVE_VIDEO': {
      // 1. Tier check: free users cannot save YouTube videos
      const credits = await apiFetch('/api/billing/credits');
      if (credits.error) {
        return credits;
      }
      if (credits.tier === 'free') {
        return {
          error: 'YouTube saves require a Researcher plan or higher',
          error_type: 'feature_locked',
          status: 403
        };
      }

      // 2. Check YouTube login — require auth cookies
      const ytCookies = await chrome.cookies.getAll({ domain: '.youtube.com' });
      const authCookieNames = ['SID', 'HSID', 'LOGIN_INFO'];
      const hasYouTubeAuth = ytCookies.some(c => authCookieNames.includes(c.name));
      if (!hasYouTubeAuth) {
        return {
          error: 'Sign in to YouTube to save videos',
          error_type: 'youtube_login_required',
          status: 403
        };
      }

      // 3. Extract YouTube cookies from browser
      const cookiesStr = await formatYouTubeCookies();

      // 4. Send to backend with cookies
      const result = await apiFetch('/api/videos/add', {
        method: 'POST',
        body: JSON.stringify({
          url_or_path: message.url,
          analyze_frames: message.analyzeFrames ?? false,
          cookies: cookiesStr
        })
      });
      if (!result.error && result.job) {
        addSavedVideo(message.url, message.title || null);
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
      const { savedUrls } = await getStorage('savedUrls');
      const urls = savedUrls || [];
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
      const videos = await getSavedVideos();
      // Return last 5 in reverse chronological order with rich data
      const recent = videos.slice(-5).reverse().map(v => ({
        url: v.url,
        videoId: v.videoId,
        title: v.title,
        thumbnail: v.videoId ? `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg` : null,
        savedAt: v.savedAt
      }));
      return { saves: recent };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}
