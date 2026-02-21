// Video Memory AI — Popup script
const $ = (sel) => document.querySelector(sel);

const views = {
  login: $('#view-login'),
  main: $('#view-main'),
  settings: $('#view-settings')
};

let webappBase = 'https://recipe-memory-ai.vercel.app';
let currentJobId = null;
let pollTimer = null;

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

// --- Helpers ---

function extractVideoId(url) {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

function getTierBadgeClass(tier) {
  const map = {
    free: 'tier-badge-free',
    starter: 'tier-badge-starter',
    pro: 'tier-badge-pro',
    team: 'tier-badge-team'
  };
  return map[tier] || 'tier-badge-free';
}

function hideAllResultSections() {
  $('#save-section').hidden = true;
  $('#progress-section').hidden = true;
  $('#success-section').hidden = true;
  $('#error-section').hidden = true;
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

  // Reset all result sections to hidden on every load
  hideAllResultSections();

  // User info
  let tier = 'free';
  if (user) {
    $('#user-email').textContent = user.email || '';
    tier = (user.tier || 'free').toLowerCase();
    const badge = $('#user-tier');
    badge.textContent = tier;
    badge.className = `tier-badge ${getTierBadgeClass(tier)}`;
  }

  // Credits (with loading skeleton)
  showCreditsSkeleton();
  const credits = await sendMessage({ type: 'GET_CREDITS' });
  hideCreditsSkeleton();

  let creditsRemaining = 0;
  if (credits && !credits.error) {
    const used = credits.credits_used || 0;
    const total = credits.credits_total || 50;
    creditsRemaining = Math.max(0, total - used);
    const pct = total > 0 ? Math.round((creditsRemaining / total) * 100) : 0;
    const bar = $('#credits-bar');
    bar.style.width = `${pct}%`;
    bar.className = 'credits-bar-fill';
    if (pct <= 10) bar.classList.add('credits-low');
    else if (pct <= 30) bar.classList.add('credits-medium');
    $('#credits-pct').textContent = pct > 15 ? `${pct}%` : '';
    $('#credits-label').textContent = `${creditsRemaining} / ${total} credits remaining`;
  }

  // Get webapp base
  const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
  webappBase = wb.webappBase || webappBase;

  // Show video preview + save button if on a YouTube video tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('youtube.com/watch')) {
    const videoId = extractVideoId(tab.url);
    if (videoId) {
      // Show thumbnail
      const preview = $('#video-preview');
      preview.hidden = false;
      $('#video-thumb').src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

      // Extract title from tab title
      const title = tab.title?.endsWith(' - YouTube')
        ? tab.title.slice(0, -10)
        : (tab.title || '');
      $('#video-title').textContent = title;

      // Check plan and credits before showing Save button
      if (tier === 'free') {
        // Free plan cannot save YouTube videos
        showError('Plan upgrade required', 'YouTube saves require a Starter plan or higher', 'feature_locked');
      } else if (creditsRemaining <= 0) {
        // No credits left
        showError('Out of credits', "You don't have enough credits for this video", 'insufficient_credits');
      } else {
        // Plan and credits OK — show the Save button
        $('#save-section').hidden = false;
      }
    }
  }

  // Recent saves (rich format)
  const recent = await sendMessage({ type: 'GET_RECENT_SAVES' });
  const saves = recent.saves || [];
  if (saves.length > 0) {
    $('#recent-section').hidden = false;
    const list = $('#recent-list');
    list.innerHTML = '';
    for (const save of saves) {
      const li = document.createElement('li');
      li.className = 'recent-item';
      li.title = save.title || save.url;
      li.addEventListener('click', () => {
        chrome.tabs.create({ url: `${webappBase}/app` });
      });
      if (save.thumbnail) {
        const img = document.createElement('img');
        img.className = 'recent-thumb';
        img.src = save.thumbnail;
        img.alt = '';
        img.onerror = () => { img.style.display = 'none'; };
        li.appendChild(img);
      }
      const info = document.createElement('div');
      info.className = 'recent-info';
      const titleEl = document.createElement('span');
      titleEl.className = 'recent-title';
      titleEl.textContent = save.title || 'Untitled video';
      info.appendChild(titleEl);
      const urlEl = document.createElement('span');
      urlEl.className = 'recent-url';
      urlEl.textContent = save.videoId ? `youtube.com/watch?v=${save.videoId}` : save.url;
      info.appendChild(urlEl);
      li.appendChild(info);
      list.appendChild(li);
    }
  }

  // Library link
  $('#link-library').href = `${webappBase}/app`;
  $('#link-library').onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${webappBase}/app` });
  };
}

// --- Credits skeleton loading ---

function showCreditsSkeleton() {
  const track = $('.credits-bar-track');
  const label = $('#credits-label');
  track.classList.add('skeleton');
  label.textContent = '';
  label.classList.add('skeleton', 'skeleton-text');
}

function hideCreditsSkeleton() {
  const track = $('.credits-bar-track');
  const label = $('#credits-label');
  track.classList.remove('skeleton');
  label.classList.remove('skeleton', 'skeleton-text');
}

// --- Progress polling ---

function startProgressPolling(jobId) {
  currentJobId = jobId;
  hideAllResultSections();
  $('#progress-section').hidden = false;
  $('#progress-bar').style.width = '0%';
  $('#progress-pct').textContent = '0%';
  $('#progress-status').textContent = 'Starting...';
  $('#progress-title').textContent = 'Processing video...';
  pollTimer = setTimeout(pollProgress, 2000);
}

function stopProgressPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function pollProgress() {
  if (!currentJobId) return;

  const result = await sendMessage({ type: 'GET_JOB_STATUS', jobId: currentJobId });

  if (result.error) {
    stopProgressPolling();
    showError('Processing failed', result.error, result.error_type);
    return;
  }

  const status = result.status;
  const progress = result.progress || 0;

  // Map job status to user-friendly text
  const statusMap = {
    'downloading': 'Downloading audio...',
    'transcribing': 'Transcribing speech...',
    'analyzing': 'Analyzing content...',
    'extracting_frames': 'Extracting frames...',
    'processing': 'Processing...',
    'queued': 'Queued...',
    'pending': 'Queued...'
  };
  const statusText = result.status_text || statusMap[status] || `Processing...`;

  if (status === 'completed') {
    stopProgressPolling();
    currentJobId = null;
    showSuccess();
  } else if (status === 'failed') {
    stopProgressPolling();
    currentJobId = null;
    showError('Processing failed', result.error || 'An unknown error occurred');
  } else {
    $('#progress-bar').style.width = `${progress}%`;
    $('#progress-pct').textContent = `${progress}%`;
    $('#progress-status').textContent = statusText;
    pollTimer = setTimeout(pollProgress, 3000);
  }
}

function showSuccess() {
  hideAllResultSections();
  $('#success-section').hidden = false;
  $('#link-view-saved').onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${webappBase}/app` });
  };
}

function showError(title, message, errorType) {
  hideAllResultSections();
  $('#error-section').hidden = false;
  $('#error-title').textContent = title;
  $('#error-message').textContent = message;

  // Reset action buttons
  $('#btn-retry').hidden = false;
  $('#btn-upgrade').hidden = true;
  $('#btn-buy-credits').hidden = true;

  if (errorType === 'feature_locked') {
    $('#error-title').textContent = 'Plan upgrade required';
    $('#error-message').textContent = 'YouTube saves require a Starter plan or higher';
    $('#btn-retry').hidden = true;
    $('#btn-upgrade').hidden = false;
    $('#btn-upgrade').href = `${webappBase}/pricing`;
    $('#btn-upgrade').onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${webappBase}/pricing` });
    };
  } else if (errorType === 'insufficient_credits') {
    $('#error-title').textContent = 'Out of credits';
    $('#error-message').textContent = "You don't have enough credits for this video";
    $('#btn-retry').hidden = true;
    $('#btn-buy-credits').hidden = false;
    $('#btn-buy-credits').href = `${webappBase}/pricing`;
    $('#btn-buy-credits').onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${webappBase}/pricing` });
    };
  } else if (errorType === 'network_error') {
    $('#error-title').textContent = 'Connection error';
    $('#error-message').textContent = "Can't reach Video Memory AI servers";
  }
}

// --- Events ---

function bindEvents() {
  // Sign in
  $('#btn-sign-in').addEventListener('click', async () => {
    const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
    const base = wb.webappBase || 'https://recipe-memory-ai.vercel.app';
    chrome.tabs.create({ url: `${base}/login?source=extension` });
    window.close();
  });

  // Save video
  $('#btn-save').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const videoId = extractVideoId(tab.url);
    if (!videoId) return;

    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const title = tab.title?.endsWith(' - YouTube')
      ? tab.title.slice(0, -10)
      : (tab.title || '');

    // Disable button
    $('#btn-save').disabled = true;
    $('#btn-save').innerHTML = `
      <span class="popup-spinner"></span>
      Saving...
    `;

    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    const result = await sendMessage({
      type: 'SAVE_VIDEO',
      url: cleanUrl,
      title,
      analyzeFrames: settings.defaultAnalyzeFrames ?? false
    });

    if (result.error) {
      showError('Save failed', result.error, result.error_type);
      return;
    }

    // Start progress tracking
    const jobId = result.job?.id || result.job_id;
    if (jobId) {
      startProgressPolling(jobId);
    } else {
      showSuccess();
    }
  });

  // Retry
  $('#btn-retry').addEventListener('click', async () => {
    hideAllResultSections();
    $('#save-section').hidden = false;
    $('#btn-save').disabled = false;
    $('#btn-save').innerHTML = `
      <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-.75 4.75a.75.75 0 011.5 0v3.5h3.5a.75.75 0 010 1.5h-3.5v3.5a.75.75 0 01-1.5 0v-3.5h-3.5a.75.75 0 010-1.5h3.5v-3.5z"/></svg>
      Save This Video
    `;
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
