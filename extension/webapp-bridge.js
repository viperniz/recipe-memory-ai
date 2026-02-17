// Video Memory AI — Webapp Bridge Content Script
// Injected on webapp pages to allow the web app to detect the extension,
// request YouTube cookies for server-side downloads,
// and relay auth tokens from the extension-callback page.

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

                               if (type === 'VMEM_REQUEST_COOKIES') {
                                       try {
                                                 const response = await chrome.runtime.sendMessage({ type: 'GET_YOUTUBE_COOKIES' });
                                                 window.postMessage(
                                                   {
                                                                 type: 'VMEM_COOKIES_RESPONSE',
                                                                 cookies: response?.cookies || null,
                                                                 error: response?.error || null
                                                   },
                                                             window.location.origin
                                                           );
                                       } catch (err) {
                                                 window.postMessage(
                                                   {
                                                                 type: 'VMEM_COOKIES_RESPONSE',
                                                                 cookies: null,
                                                                 error: err.message
                                                   },
                                                             window.location.origin
                                                           );
                                       }
                                       return;
                               }

                               // Auth relay — handles token from ExtensionCallbackPage
                               // This runs on ALL webapp pages so it works with SPA client-side routing
                               if (type === 'VMEM_EXTENSION_AUTH') {
                                       console.log('[VMEM Bridge] Received VMEM_EXTENSION_AUTH', {
                                                 hasToken: !!event.data.token,
                                                 hasUser: !!event.data.user
                                       });

           try {
                     const response = await chrome.runtime.sendMessage({
                                 type: 'SET_TOKEN',
                                 token: event.data.token,
                                 user: event.data.user
                     });

                                         if (chrome.runtime.lastError) {
                                                     console.error('[VMEM Bridge] Failed to send token to background:', chrome.runtime.lastError.message);
                                         } else {
                                                     console.log('[VMEM Bridge] Token saved successfully:', response);
                                         }
           } catch (err) {
                     console.error('[VMEM Bridge] Error sending token:', err.message);
           }
                                       return;
                               }
   });
})();
