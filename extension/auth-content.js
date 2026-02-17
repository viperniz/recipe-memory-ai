// Video Memory AI — Auth bridge content script
// Injected on /extension-callback pages to relay the JWT token to the extension.

console.log('[VMEM Auth Bridge] Content script loaded on', window.location.href);

window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'VMEM_EXTENSION_AUTH') return;

                          console.log('[VMEM Auth Bridge] Received VMEM_EXTENSION_AUTH message', {
                                hasToken: !!event.data.token,
                                hasUser: !!event.data.user
                          });

                          chrome.runtime.sendMessage({
                                type: 'SET_TOKEN',
                                token: event.data.token,
                                user: event.data.user
                          }, (response) => {
                                if (chrome.runtime.lastError) {
                                        console.error('[VMEM Auth Bridge] Failed to send token to background:', chrome.runtime.lastError.message);
                                } else {
                                        console.log('[VMEM Auth Bridge] Token saved successfully:', response);
                                }
                          });
});
