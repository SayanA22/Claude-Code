/*
 * background.js — adds "Is this a scam?" to the right-click menu.
 *
 * When the user clicks it, we open a small window (results.html) and pass
 * along the highlighted text and/or the link they right-clicked.
 *
 * This file does NOT look at web pages and makes NO network requests.
 * It only runs when the user clicks the menu item.
 */

const MENU_ID = "check-scam";

// Create the menu item once, when the extension is installed or updated.
// (Manifest V3 service workers go to sleep, so we can't do this on every start.)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Is this a scam?",
    contexts: ["link", "selection"] // show it for links and highlighted text only
  });
});

// The user clicked our menu item.
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;

  // Collect whatever they pointed at. If they right-clicked a link, we check
  // the link's REAL address (not just the words you can see on the page).
  const pieces = [];
  if (info.selectionText) pieces.push(info.selectionText);
  if (info.linkUrl) pieces.push(info.linkUrl);

  // Keep it short enough to fit comfortably in a web address.
  const text = pieces.join("\n").slice(0, 3000);

  // Open the results in a small window.
  chrome.windows.create({
    url: "results.html?text=" + encodeURIComponent(text),
    type: "popup",
    width: 540,
    height: 800
  });
});
