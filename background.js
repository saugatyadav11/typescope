chrome.action.onClicked.addListener((tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  chrome.tabs.sendMessage(tab.id, { type: 'typoscope:togglePanel' }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'typoscope:openPopup') {
    const tabId = sender?.tab?.id;
    if (typeof tabId === 'number') {
      chrome.tabs.sendMessage(tabId, { type: 'typoscope:showPanel' }).catch(() => {});
    }
  }
});
