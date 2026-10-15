/**
 * Background Service Worker
 * - Opens the options page on install
 * - Updates the ON/OFF badge
 * - Keeps per-tab "run state" (which login steps were already executed) so the
 *   content script does not loop on a page when a login fails.
 */

const ENABLED_KEY = 'gl_enabled';
const runKey = (tabId) => `run_${tabId}`;

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ [ENABLED_KEY]: true });
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined) return false;

  switch (message.action) {
    case 'runState:get':
      chrome.storage.session.get(runKey(tabId))
        .then((result) => sendResponse(result[runKey(tabId)] || null));
      return true;

    case 'runState:set':
      chrome.storage.session.set({ [runKey(tabId)]: message.state })
        .then(() => sendResponse({ ok: true }));
      return true;

    default:
      return false;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(runKey(tabId));
});

async function updateBadge() {
  const result = await chrome.storage.local.get(ENABLED_KEY);
  const enabled = result[ENABLED_KEY] !== false;

  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#4CAF50' : '#F44336' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[ENABLED_KEY]) {
    updateBadge();
  }
});

updateBadge();
