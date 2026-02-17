// Video Memory AI — YouTube Content Script

(() => {
  const BUTTON_ID = 'vmem-save-btn';
  const POLL_INTERVAL = 3000;

  let currentVideoUrl = null;
  let currentJobId = null;
  let pollTimer = null;
  let isLoggedIn = false;
  let webappBase = 'https://recipe-memory-ai.vercel.app';

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
    ALREADY_SAVED: 'already_saved'
  };

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

  // --- Button rendering ---

  function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'vmem-btn vmem-btn-idle';
    btn.innerHTML = `
      <img class="vmem-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="" />
      <span class="vmem-label">Save to Video Memory</span>
    `;
    btn.addEventListener('click', onButtonClick);
    return btn;
  }

  function updateButton(state, extra = {}) {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    // Reset classes
    btn.className = 'vmem-btn';
    btn.disabled = false;
    btn.onclick = onButtonClick;

    switch (state) {
      case STATE.NOT_LOGGED_IN:
        btn.classList.add('vmem-btn-muted');
        btn.innerHTML = `
          <img class="vmem-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="" />
          <span class="vmem-label">Sign in to save</span>
        `;
        break;

      case STATE.IDLE:
        btn.classList.add('vmem-btn-idle');
        btn.innerHTML = `
          <img class="vmem-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="" />
          <span class="vmem-label">Save to Video Memory</span>
        `;
        break;

      case STATE.SAVING:
        btn.classList.add('vmem-btn-saving');
        btn.disabled = true;
        btn.innerHTML = `
          <span class="vmem-spinner"></span>
          <span class="vmem-label">Saving...</span>
        `;
        break;

      case STATE.PROCESSING:
        btn.classList.add('vmem-btn-saving');
        btn.disabled = true;
        const pct = extra.progress || 0;
        btn.innerHTML = `
          <span class="vmem-spinner"></span>
          <span class="vmem-label">Processing ${pct}%...</span>
        `;
        break;

      case STATE.DONE:
        btn.classList.add('vmem-btn-done');
        btn.innerHTML = `
          <span class="vmem-check">&#10003;</span>
          <span class="vmem-label">Saved &mdash; View in Library</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/app`, '_blank');
        break;

      case STATE.ERROR:
        btn.classList.add('vmem-btn-error');
        btn.innerHTML = `
          <span class="vmem-label">Failed &mdash; Retry?</span>
        `;
        break;

      case STATE.NO_CREDITS:
        btn.classList.add('vmem-btn-warning');
        btn.innerHTML = `
          <span class="vmem-label">No credits &mdash; Get more</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/pricing`, '_blank');
        break;

      case STATE.TIER_LOCKED:
        btn.classList.add('vmem-btn-warning');
        btn.innerHTML = `
          <span class="vmem-label">Upgrade to save videos</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/pricing`, '_blank');
        break;

      case STATE.ALREADY_SAVED:
        btn.classList.add('vmem-btn-done');
        btn.innerHTML = `
          <span class="vmem-check">&#10003;</span>
          <span class="vmem-label">Already saved &mdash; View</span>
        `;
        btn.onclick = () => window.open(`${webappBase}/app`, '_blank');
        break;
    }
  }

  // --- Injection ---

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = createButton();

    // Try YouTube's action buttons container
    const actionBar = document.querySelector('#top-level-buttons-computed');
    if (actionBar) {
      actionBar.appendChild(btn);
      return;
    }

    // Fallback: fixed floating button
    btn.classList.add('vmem-btn-floating');
    document.body.appendChild(btn);
  }

  function removeButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
    stopPolling();
  }

  // --- Actions ---

  async function onButtonClick() {
    if (!isLoggedIn) {
      // Open webapp login with extension source
      window.open(`${webappBase}/login?source=extension`, '_blank');
      return;
    }

    const url = getVideoUrl();
    if (!url) return;

    updateButton(STATE.SAVING);

    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    const result = await sendMessage({
      type: 'SAVE_VIDEO',
      url,
      analyzeFrames: settings.defaultAnalyzeFrames ?? false
    });

    if (result.error) {
      if (result.status === 403 && result.error_type === 'feature_locked') {
        updateButton(STATE.TIER_LOCKED);
      } else if (result.status === 403 && result.error_type === 'insufficient_credits') {
        updateButton(STATE.NO_CREDITS);
      } else if (result.status === 401) {
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
      // Direct completion (unlikely but handle)
      updateButton(STATE.DONE);
    }
  }

  // --- Job polling ---

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollJob, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
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

    if (status === 'completed') {
      stopPolling();
      currentJobId = null;
      updateButton(STATE.DONE);
    } else if (status === 'failed') {
      stopPolling();
      currentJobId = null;
      updateButton(STATE.ERROR);
    } else {
      updateButton(STATE.PROCESSING, { progress });
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

    injectButton();

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

    updateButton(STATE.IDLE);
  }

  // Listen for YouTube SPA navigation
  document.addEventListener('yt-navigate-finish', () => {
    if (location.pathname === '/watch') {
      // Small delay to let YouTube render action buttons
      setTimeout(initForVideo, 500);
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
