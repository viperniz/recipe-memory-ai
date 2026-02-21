// Video Memory AI — YouTube Content Script

(() => {
  const BUTTON_ID = 'vmem-save-btn';
  const POLL_INTERVAL = 3000;

  let currentVideoUrl = null;
  let currentJobId = null;
  let pollTimer = null;
  let isLoggedIn = false;
  let webappBase = 'https://recipe-memory-ai.vercel.app';
  let injectionObserver = null;

  // --- Inline SVG icon (crisp at all zoom levels) ---

  const ICON_SVG = `<svg class="vmem-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="url(#vmem-grad)"/>
    <path d="M9.5 7.5L17 12L9.5 16.5V7.5Z" fill="white" fill-opacity="0.95"/>
    <path d="M18.5 5.5L18.5 4M19.5 5.5L18.5 5.5M18.5 5.5L17.5 5.5M18.5 5.5L18.5 7" stroke="#FCD34D" stroke-width="1" stroke-linecap="round"/>
    <defs>
      <linearGradient id="vmem-grad" x1="1" y1="1" x2="23" y2="23">
        <stop stop-color="#8B5CF6"/>
        <stop offset="0.5" stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#6D28D9"/>
      </linearGradient>
    </defs>
  </svg>`;

  // --- State ---

  const STATE = {
    NOT_LOGGED_IN: 'not_logged_in',
    IDLE: 'idle',
    SAVING: 'saving',
    PROCESSING: 'processing',
    DONE: 'done',
    ERROR: 'error',
    NO_CREDITS: 'no_credits',
    TIER_LOCKED: 'tier_locked',
    ALREADY_SAVED: 'already_saved',
    YOUTUBE_LOGIN: 'youtube_login'
  };

  const YOUTUBE_LOGIN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube';

  // --- Helpers ---

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        resolve(response || {});
      });
    });
  }

  function getVideoUrl() {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v');
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  }

  function getVideoTitle() {
    // Try to extract from YouTube's page
    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string, #title h1');
    if (titleEl) return titleEl.textContent.trim();
    // Fallback: document title minus " - YouTube"
    const dt = document.title;
    return dt.endsWith(' - YouTube') ? dt.slice(0, -10) : dt;
  }

  // --- Button rendering ---

  function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'vmem-btn vmem-btn-idle';
    btn.title = 'Save this video to Video Memory AI';
    btn.innerHTML = `
      ${ICON_SVG}
      <span class="vmem-label">Save to Memory</span>
    `;
    btn.addEventListener('click', onButtonClick);
    return btn;
  }

  function updateButton(state, extra = {}) {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    // Reset classes but keep base
    btn.className = 'vmem-btn';
    if (btn.classList.contains('vmem-btn-floating')) {
      btn.classList.add('vmem-btn-floating');
    }
    btn.disabled = false;
    btn.onclick = onButtonClick;

    switch (state) {
      case STATE.NOT_LOGGED_IN:
        btn.classList.add('vmem-btn-muted');
        btn.title = 'Sign in to save videos';
        btn.innerHTML = `
          ${ICON_SVG}
          <span class="vmem-label">Sign in to save</span>
        `;
        break;

      case STATE.IDLE:
        btn.classList.add('vmem-btn-idle');
        btn.title = 'Save this video to Video Memory AI';
        btn.innerHTML = `
          ${ICON_SVG}
          <span class="vmem-label">Save to Memory</span>
        `;
        break;

      case STATE.SAVING:
        btn.classList.add('vmem-btn-saving');
        btn.disabled = true;
        btn.title = 'Saving video...';
        btn.innerHTML = `
          <span class="vmem-spinner"></span>
          <span class="vmem-label">Saving...</span>
        `;
        break;

      case STATE.PROCESSING:
        btn.classList.add('vmem-btn-processing');
        btn.disabled = true;
        const pct = extra.progress || 0;
        const statusText = extra.status_text || `Processing ${pct}%`;
        btn.title = statusText;
        btn.innerHTML = `
          <span class="vmem-spinner"></span>
          <span class="vmem-label">${statusText}...</span>
          <span class="vmem-progress-ring" style="--pct: ${pct}"></span>
        `;
        break;

      case STATE.DONE:
        btn.classList.add('vmem-btn-done');
        btn.title = 'Saved! Click to open your library';
        btn.innerHTML = `
          <svg class="vmem-check-svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          <span class="vmem-label">Saved — View in Library</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/app`, '_blank');
        break;

      case STATE.ERROR:
        btn.classList.add('vmem-btn-error', 'vmem-shake');
        btn.title = 'Save failed — click to retry';
        btn.innerHTML = `
          <svg class="vmem-error-svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          <span class="vmem-label">Failed — Retry</span>
        `;
        // Remove shake after animation
        setTimeout(() => btn.classList.remove('vmem-shake'), 500);
        break;

      case STATE.NO_CREDITS:
        btn.classList.add('vmem-btn-warning');
        btn.title = 'Out of credits — click to get more';
        btn.innerHTML = `
          <svg class="vmem-warning-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 14z"/></svg>
          <span class="vmem-label">No credits — Get more</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/pricing`, '_blank');
        break;

      case STATE.TIER_LOCKED:
        btn.classList.add('vmem-btn-warning');
        btn.title = 'Upgrade your plan to save YouTube videos';
        btn.innerHTML = `
          <svg class="vmem-lock-svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          <span class="vmem-label">Upgrade to save</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/pricing`, '_blank');
        break;

      case STATE.ALREADY_SAVED:
        btn.classList.add('vmem-btn-done');
        btn.title = 'Already saved — click to view in library';
        btn.innerHTML = `
          <svg class="vmem-check-svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          <span class="vmem-label">Already saved — View</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/app`, '_blank');
        break;

      case STATE.YOUTUBE_LOGIN:
        btn.classList.add('vmem-btn-youtube');
        btn.title = 'Sign in to YouTube to save videos';
        btn.innerHTML = `
          <svg class="vmem-lock-svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          <span class="vmem-label">Sign in to YouTube</span>
        `;
        btn.onclick = () => window.open(YOUTUBE_LOGIN_URL, '_blank');
        break;
    }
  }

  // --- Injection ---

  function findInjectionTarget() {
    // Try YouTube's action buttons (most common)
    const targets = [
      '#top-level-buttons-computed',
      '#actions ytd-menu-renderer #top-level-buttons-computed',
      '#actions #menu',
      'ytd-watch-metadata #actions'
    ];
    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = createButton();
    const target = findInjectionTarget();

    if (target) {
      target.appendChild(btn);
    } else {
      // Floating fallback
      btn.classList.add('vmem-btn-floating');
      document.body.appendChild(btn);
    }
  }

  function removeButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
    stopPolling();
    stopObserver();
  }

  // --- MutationObserver: re-inject if YouTube re-renders the action bar ---

  function startObserver() {
    stopObserver();
    injectionObserver = new MutationObserver(() => {
      // If our button disappeared but we're on a watch page, re-inject
      if (location.pathname === '/watch' && !document.getElementById(BUTTON_ID)) {
        injectButton();
        // Re-apply current state
        if (!isLoggedIn) {
          updateButton(STATE.NOT_LOGGED_IN);
        } else if (currentJobId) {
          updateButton(STATE.PROCESSING, { progress: 0 });
        }
      }
    });

    const actionsContainer = document.querySelector('#actions, ytd-watch-metadata');
    if (actionsContainer) {
      injectionObserver.observe(actionsContainer, { childList: true, subtree: true });
    }
  }

  function stopObserver() {
    if (injectionObserver) {
      injectionObserver.disconnect();
      injectionObserver = null;
    }
  }

  // --- Actions ---

  async function onButtonClick() {
    if (!isLoggedIn) {
      window.open(`${webappBase}/login?source=extension`, '_blank');
      return;
    }

    const url = getVideoUrl();
    if (!url) return;

    updateButton(STATE.SAVING);

    const title = getVideoTitle();
    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    const result = await sendMessage({
      type: 'SAVE_VIDEO',
      url,
      title,
      analyzeFrames: settings.defaultAnalyzeFrames ?? false
    });

    if (result.error) {
      if (result.error_type === 'youtube_login_required') {
        updateButton(STATE.YOUTUBE_LOGIN);
      } else if (result.error_type === 'feature_locked') {
        updateButton(STATE.TIER_LOCKED);
      } else if (result.error_type === 'insufficient_credits') {
        updateButton(STATE.NO_CREDITS);
      } else if (result.status === 401 || result.error_type === 'unauthorized') {
        isLoggedIn = false;
        updateButton(STATE.NOT_LOGGED_IN);
      } else {
        updateButton(STATE.ERROR);
      }
      return;
    }

    const jobId = result.job?.id || result.job_id;
    if (jobId) {
      currentJobId = jobId;
      updateButton(STATE.PROCESSING, { progress: 0 });
      startPolling();
    } else {
      updateButton(STATE.DONE);
    }
  }

  // --- Job polling ---

  function startPolling() {
    stopPolling();
    pollTimer = setTimeout(pollJob, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function pollJob() {
    if (!currentJobId) {
      stopPolling();
      return;
    }

    const result = await sendMessage({ type: 'GET_JOB_STATUS', jobId: currentJobId });

    if (result.error) {
      stopPolling();
      updateButton(STATE.ERROR);
      return;
    }

    const status = result.status;
    const progress = result.progress || 0;
    const statusText = result.status_text || null;

    if (status === 'completed') {
      stopPolling();
      currentJobId = null;
      updateButton(STATE.DONE);
    } else if (status === 'failed') {
      stopPolling();
      currentJobId = null;
      updateButton(STATE.ERROR);
    } else {
      updateButton(STATE.PROCESSING, { progress, status_text: statusText });
      // Continue polling with setTimeout chain (not setInterval)
      pollTimer = setTimeout(pollJob, POLL_INTERVAL);
    }
  }

  // --- Init & SPA navigation ---

  async function initForVideo() {
    const url = getVideoUrl();
    if (!url) {
      removeButton();
      return;
    }

    // Reset state for new video
    currentVideoUrl = url;
    currentJobId = null;
    stopPolling();

    // Use requestAnimationFrame + retry for faster injection
    requestAnimationFrame(() => {
      injectButton();
      startObserver();
    });

    // Check auth
    const auth = await sendMessage({ type: 'GET_AUTH_STATUS' });
    isLoggedIn = auth.isLoggedIn;

    if (!isLoggedIn) {
      updateButton(STATE.NOT_LOGGED_IN);
      return;
    }

    // Get webapp base
    const wb = await sendMessage({ type: 'GET_WEBAPP_BASE' });
    webappBase = wb.webappBase || webappBase;

    // Check if already saved
    const check = await sendMessage({ type: 'CHECK_SAVED', url });
    if (check.saved) {
      updateButton(STATE.ALREADY_SAVED);
      return;
    }

    // Proactive tier check — show upgrade prompt before user clicks Save
    const credits = await sendMessage({ type: 'GET_CREDITS' });
    if (credits && !credits.error && credits.tier === 'free') {
      updateButton(STATE.TIER_LOCKED);
      return;
    }

    updateButton(STATE.IDLE);
  }

  // Listen for YouTube SPA navigation
  document.addEventListener('yt-navigate-finish', () => {
    if (location.pathname === '/watch') {
      // Use rAF instead of fixed timeout for faster injection
      requestAnimationFrame(() => {
        // Small delay to let YouTube render action buttons, but less than before
        setTimeout(initForVideo, 200);
      });
    } else {
      removeButton();
    }
  });

  // Listen for auth changes from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VMEM_AUTH_CHANGED') {
      isLoggedIn = message.isLoggedIn;
      if (document.getElementById(BUTTON_ID)) {
        if (isLoggedIn) {
          initForVideo();
        } else {
          updateButton(STATE.NOT_LOGGED_IN);
        }
      }
    }
  });

  // Initial load (if already on a /watch page)
  if (location.pathname === '/watch') {
    initForVideo();
  }
})();
