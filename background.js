chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'typoscope:openPopup') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const tabId = tabs[0].id;
        chrome.action.openPopup(() => {
          if (chrome.runtime.lastError) return;
          if (typeof tabId === 'number') {
            setTimeout(() => {
              chrome.tabs.update(tabId, { active: true }).catch(() => {});
            }, 50);
          }
        });
      }
    });
  }
});
