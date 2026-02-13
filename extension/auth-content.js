// Video Memory AI — Auth bridge content script
// Injected on /extension-callback pages to relay the JWT token to the extension.

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'VMEM_EXTENSION_AUTH') return;

  chrome.runtime.sendMessage({
    type: 'SET_TOKEN',
    token: event.data.token,
    user: event.data.user
  });
});
