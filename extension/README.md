# WorkBox browser extension (Chrome / Edge / Brave — Manifest V3)

Capture jobs, leads, bookmarks and tasks into WorkBox — and ask its AI — from any tab.

## Activate it (developer / unpacked)

1. **Get an API key**: open WorkBox → **Settings → API Keys** → create a key and copy it (shown once).
2. **Load the extension**:
   - Go to `chrome://extensions` (or `edge://extensions`).
   - Turn on **Developer mode** (top-right).
   - Click **Load unpacked** and select this `extension/` folder.
   - Pin the WorkBox icon to your toolbar.
3. **Connect it**: click the WorkBox icon → **Connect WorkBox** (or the ⚙ gear) → paste your **API key**. Leave the URL as the default (`https://workbox-blue.vercel.app`) unless you self-host, then click **Save & test** — it should say ✓ Connected.

That's it. No build step — it's plain HTML/JS.

## What it does

**Toolbar popup** (click the icon):
- **Capture** — save the current tab as a **task**, a **job/opportunity** (auto due date +5 days if none), or a **bookmark** (pick a folder). On a LinkedIn profile, **Save lead → CRM** scrapes the name/role/company and adds a contact (with the profile URL, and Apollo enrichment when configured).
- **Today** — tasks due today + your meetings.
- **Search** — find tasks, docs and knowledge; click to open in WorkBox.
- **Ask AI** — ask the WorkBox agent anything ("what's overdue this week?").

**Right-click menu** (on any page/selection):
- Save selection as a task, save as a job/opportunity, or bookmark the page.

**Toolbar badge** shows your unread WorkBox notification count.

## Notes

- Host access is pre-approved for `workbox-blue.vercel.app` and `localhost:3000`. If you self-host on another domain, add it to `host_permissions` in `manifest.json`.
- The icons are placeholder purple squares — drop branded PNGs into `icons/` to replace them (the brand mark SVGs live in `frontend/docs/brand/`).
- Publishing to the Chrome Web Store later just needs this folder zipped + a developer account.
