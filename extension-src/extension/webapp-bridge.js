// Video Memory AI — Webapp Bridge Content Script
// Injected on webapp pages to allow the web app to detect the extension
// and request YouTube cookies for server-side downloads.

(function () {
  const EXTENSION_VERSION = chrome.runtime.getManifest().version;

  window.addEventListener('message', async (event) => {
    // Only accept messages from the same window (the webapp)
    if (event.source !== window) return;

    const { type } = event.data || {};

    if (type === 'VMEM_PING') {
      window.postMessage(
        { type: 'VMEM_PONG', version: EXTENSION_VERSION },
        window.location.origin
      );
      return;
    }

    // Auth relay: ExtensionCallbackPage sends token after Google/email login
    if (type === 'VMEM_EXTENSION_AUTH') {
      chrome.runtime.sendMessage({
        type: 'SET_TOKEN',
        token: event.data.token,
        user: event.data.user
      });
      return;
    }

    if (type === 'VMEM_REQUEST_COOKIES') {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_YOUTUBE_COOKIES' });
        window.postMessage(
          { type: 'VMEM_COOKIES_RESPONSE', cookies: response?.cookies || null, error: response?.error || null },
          window.location.origin
        );
      } catch (err) {
        window.postMessage(
          { type: 'VMEM_COOKIES_RESPONSE', cookies: null, error: err.message },
          window.location.origin
        );
      }
      return;
    }
  });
})();
