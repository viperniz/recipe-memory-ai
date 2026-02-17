// Video Memory AI — Popup script

const $ = (sel) => document.querySelector(sel);

const views = {
  login: $('#view-login'),
  main: $('#view-main'),
  settings: $('#view-settings')
};

function showView(name) {
  Object.values(views).forEach((v) => v.hidden = true);
  views[name].hidden = false;
}

// --- Messaging ---

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response || {});
    });
  });
}

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await sendMessage({ type: 'GET_AUTH_STATUS' });

  if (!auth.isLoggedIn) {
    showView('login');
  } else {
    await showMainView(auth.user);
  }

  bindEvents();
});

// --- Main view ---

async function showMainView(user) {
  showView('main');

  // User info
  if (user) {
    $('#user-email').textContent = user.email || '';
    $('#user-tier').textContent = user.tier || 'free';
  }

  // Credits
  const credits = await sendMessage({ type: 'GET_CREDITS' });
  if (credits && !credits.error) {
    const used = credits.credits_used || 0;
    const total = credits.credits_total || 50;
    const remaining = Math.max(0, total - used);
    const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
    $('#credits-bar').style.width = `${pct}%`;
    $('#credits-label').textContent = `${remaining} / ${total} credits remaining`;
  }

  // Show save button if on a YouTube video tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('youtube.com/watch')) {
    $('#save-section').hidden = false;
  }

  // Recent saves
  const recent = await sendMessage({ type: 'GET_RECENT_SAVES' });
  if (recent.urls && recent.urls.length > 0) {
    $('#recent-section').hidden = false;
    const list = $('#recent-list');
    list.innerHTML = '';
    for (const url of recent.urls) {
      const li = document.createElement('li');
      li.textContent = url;
      li.title = url;
      list.appendChild(li);
    }
  }

  // Library link
  const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
  const webappBase = wb.webappBase || 'https://recipe-memory-ai.vercel.app';
  $('#link-library').href = `${webappBase}/app`;
  $('#link-library').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${webappBase}/app` });
  });
}

// --- Events ---

function bindEvents() {
  // Sign in
  $('#btn-sign-in').addEventListener('click', async () => {
    const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
    const webappBase = wb.webappBase || 'https://recipe-memory-ai.vercel.app';
    chrome.tabs.create({ url: `${webappBase}/login?source=extension` });
    window.close();
  });

  // Save video
  $('#btn-save').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    // Extract clean video URL
    const url = new URL(tab.url);
    const videoId = url.searchParams.get('v');
    if (!videoId) return;
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    $('#btn-save').disabled = true;
    $('#btn-save').textContent = 'Saving...';

    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    const result = await sendMessage({
      type: 'SAVE_VIDEO',
      url: cleanUrl,
      analyzeFrames: settings.defaultAnalyzeFrames ?? false
    });

    if (result.error) {
      if (result.status === 403 && result.error_type === 'feature_locked') {
        $('#btn-save').textContent = 'Upgrade to save videos';
        $('#btn-save').disabled = false;
        const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
        $('#btn-save').onclick = () => {
          chrome.tabs.create({ url: `${(wb.webappBase || 'https://recipe-memory-ai.vercel.app')}/pricing` });
        };
      } else if (result.status === 403 && result.error_type === 'insufficient_credits') {
        $('#btn-save').textContent = 'No credits — Get more';
        $('#btn-save').disabled = false;
        const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
        $('#btn-save').onclick = () => {
          chrome.tabs.create({ url: `${(wb.webappBase || 'https://recipe-memory-ai.vercel.app')}/pricing` });
        };
      } else {
        $('#btn-save').textContent = 'Failed — Try again';
        $('#btn-save').disabled = false;
      }
    } else {
      $('#btn-save').textContent = 'Saved! Processing...';
      // Close popup — content script will track progress
      setTimeout(() => window.close(), 1500);
    }
  });

  // Settings
  $('#btn-settings').addEventListener('click', async () => {
    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    $('#input-api-base').value = settings.apiBase || '';
    $('#input-webapp-base').value = settings.webappBase || '';
    $('#input-analyze-frames').checked = settings.defaultAnalyzeFrames || false;
    showView('settings');
  });

  // Save settings
  $('#btn-save-settings').addEventListener('click', async () => {
    await sendMessage({
      type: 'SAVE_SETTINGS',
      apiBase: $('#input-api-base').value.replace(/\/$/, ''),
      webappBase: $('#input-webapp-base').value.replace(/\/$/, ''),
      defaultAnalyzeFrames: $('#input-analyze-frames').checked
    });
    const auth = await sendMessage({ type: 'GET_AUTH_STATUS' });
    await showMainView(auth.user);
  });

  // Back from settings
  $('#btn-back').addEventListener('click', async () => {
    const auth = await sendMessage({ type: 'GET_AUTH_STATUS' });
    await showMainView(auth.user);
  });

  // Sign out
  $('#btn-sign-out').addEventListener('click', async () => {
    await sendMessage({ type: 'LOGOUT' });
    showView('login');
  });
}
