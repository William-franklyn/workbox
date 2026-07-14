/* WorkBox extension service worker: right-click capture + unread badge. */
importScripts("wb.js");

const MENUS = [
  { id: "wb-task", title: "WorkBox: save selection as task", contexts: ["selection"] },
  { id: "wb-job", title: "WorkBox: save as job / opportunity (due in 5 days)", contexts: ["selection", "link", "page"] },
  { id: "wb-bookmark", title: "WorkBox: bookmark this page", contexts: ["page", "link"] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => MENUS.forEach((m) => chrome.contextMenus.create(m)));
  chrome.alarms.create("wb-badge", { periodInMinutes: 5 });
  refreshBadge();
});
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "wb-badge") refreshBadge(); });

async function refreshBadge() {
  try {
    const d = await WB.api("/api/v1/notifications");
    const n = d.unread_count ?? 0;
    await chrome.action.setBadgeText({ text: n ? String(n) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
  } catch { /* not configured yet */ }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url || "";
  const title = (info.selectionText || tab?.title || "Saved from web").trim().slice(0, 200);
  try {
    if (info.menuItemId === "wb-task") {
      await WB.api("/api/v1/capture", { method: "POST", body: { kind: "task", title, url } });
    } else if (info.menuItemId === "wb-job") {
      await WB.api("/api/v1/capture", { method: "POST", body: { kind: "job", title, url } });
    } else if (info.menuItemId === "wb-bookmark") {
      await WB.api("/api/v1/bookmarks", { method: "POST", body: { kind: "link", title: tab?.title || title, url } });
    }
    notify("Saved to WorkBox ✓", title);
    refreshBadge();
  } catch (e) {
    notify("WorkBox — couldn't save", e.message);
  }
});

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: (message || "").slice(0, 180),
  });
}
