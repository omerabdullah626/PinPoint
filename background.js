/**
 * Pinpoint - Background Service Worker
 * Manages context menu registration and click routing to content scripts.
 */

const MENU_ID = "pinpoint-bookmark-spot";

const SUPPORTED_PATTERNS = [
  "https://chatgpt.com/*",
  "https://*.chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://*.openai.com/*",
  "https://claude.ai/*",
  "https://*.claude.ai/*",
  "https://gemini.google.com/*"
];

function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Bookmark this spot",
      contexts: ["all"],
      documentUrlPatterns: SUPPORTED_PATTERNS
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[Pinpoint] Context menu registration warning:", chrome.runtime.lastError.message);
      }
    });
  });
}

// Register on extension install or update
chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

// Also ensure menu exists when service worker wakes up
chrome.runtime.onStartup.addListener(() => {
  registerContextMenu();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "create-bookmark" }).catch((err) => {
      console.warn("[Pinpoint] Failed to notify content script:", err);
    });
  }
});
