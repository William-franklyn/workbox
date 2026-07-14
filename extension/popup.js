let TAB = null; // active browser tab

const $ = (id) => document.getElementById(id);
function toast(msg, ok = true) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast " + (ok ? "ok" : "err");
  if (ok) setTimeout(() => { if (t.textContent === msg) { t.textContent = ""; t.className = "toast"; } }, 3500);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// LinkedIn DOM scrape — runs in the page context.
function scrapeLinkedIn() {
  const txt = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const name = txt("h1");
  let headline = txt(".text-body-medium.break-words") || txt(".text-body-medium") || "";
  headline = headline.replace(/\s+/g, " ").trim();
  return { name, headline, url: location.href.split("?")[0] };
}

async function init() {
  const { apiKey } = await WB.getConfig();
  if (!apiKey) {
    $("setup").style.display = "block";
    $("app").style.display = "none";
    return;
  }
  $("setup").style.display = "none";
  $("app").style.display = "block";

  TAB = await activeTab();
  $("pgTitle").textContent = TAB?.title || "Current page";
  $("pgUrl").textContent = TAB?.url || "";

  const isLinkedIn = /(^|\.)linkedin\.com/.test(new URL(TAB?.url || "https://x").hostname);
  if (isLinkedIn) $("capLead").style.display = "flex";

  // Load bookmark folders into the picker (best-effort).
  WB.api("/api/v1/bookmarks").then((d) => {
    for (const f of d.folders || []) {
      const o = document.createElement("option");
      o.value = f.id; o.textContent = f.name;
      $("bmFolder").appendChild(o);
    }
  }).catch(() => {});
}

// ---- Capture actions ----
$("capTask").onclick = () => save("/api/v1/capture", { kind: "task", title: TAB.title, url: TAB.url }, "Task saved");
$("capJob").onclick = () => save("/api/v1/capture", { kind: "job", title: TAB.title, url: TAB.url }, "Saved — due in 5 days");
$("capBookmark").onclick = () =>
  save("/api/v1/bookmarks", { kind: "link", title: TAB.title, url: TAB.url, folder_id: $("bmFolder").value || null }, "Bookmarked");

$("capLead").onclick = async () => {
  try {
    const [inj] = await chrome.scripting.executeScript({ target: { tabId: TAB.id }, func: scrapeLinkedIn });
    const { name, headline, url } = inj.result || {};
    if (!name) return toast("Couldn't read the profile — open it fully first", false);
    const [first, ...rest] = name.split(" ");
    const company = (headline.split(/\s+at\s+|\s+@\s+/i)[1] || "").trim();
    const job = (headline.split(/\s+at\s+|\s+@\s+/i)[0] || "").trim();
    await WB.api("/api/v1/crm", { method: "POST", body: { first_name: first, last_name: rest.join(" "), job_title: job, company, linkedin_url: url } });
    toast("Lead added to CRM ✓");
  } catch (e) { toast(e.message, false); }
};

async function save(path, body, okMsg) {
  try { await WB.api(path, { method: "POST", body }); toast(okMsg + " ✓"); }
  catch (e) { toast(e.message, false); }
}

// ---- Tabs ----
document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("on"));
    t.classList.add("on");
    const name = t.dataset.tab;
    $("panel-" + name).classList.add("on");
    if (name === "today") loadToday();
  };
});

// ---- Today ----
let todayLoaded = false;
async function loadToday() {
  if (todayLoaded) return; todayLoaded = true;
  const el = $("panel-today");
  const today = new Date().toISOString().slice(0, 10);
  let html = "";
  try {
    const d = await WB.api(`/api/v1/tasks?due=${today}`);
    const tasks = d.tasks || d || [];
    html += `<div class="muted" style="margin-bottom:6px">Due today · ${tasks.length}</div>`;
    if (!tasks.length) html += `<div class="dim">Nothing due today 🎉</div>`;
    for (const t of tasks.slice(0, 12)) {
      html += `<div class="row"><span style="flex:1">${esc(t.title)}</span><span class="pill">${esc((t.status || "").replace("_", " "))}</span></div>`;
    }
  } catch (e) { html += `<div class="err" style="color:#f87171">${esc(e.message)}</div>`; }
  try {
    const m = await WB.api("/api/v1/meetings");
    const mtgs = m.meetings || [];
    if (mtgs.length) {
      html += `<div class="muted" style="margin:12px 0 6px">Meetings</div>`;
      for (const mt of mtgs.slice(0, 6)) html += `<div class="row"><span style="flex:1">${esc(mt.title || "Meeting")}</span><span class="dim">${esc((mt.start || "").slice(11, 16))}</span></div>`;
    }
  } catch { /* calendar not connected — skip */ }
  el.innerHTML = html;
}

// ---- Search ----
let searchTimer;
$("searchInput").oninput = (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $("searchResults").innerHTML = ""; return; }
  searchTimer = setTimeout(async () => {
    try {
      const d = await WB.api(`/api/v1/search?q=${encodeURIComponent(q)}`);
      const results = d.results || [];
      const { baseUrl } = await WB.getConfig();
      $("searchResults").innerHTML = results.length
        ? results.slice(0, 12).map((r) => `<div class="row" data-href="${esc(r.href || "/home")}"><span style="flex:1">${esc(r.title || "Untitled")}</span><span class="pill">${esc((r.type || "").replace("_", " "))}</span></div>`).join("")
        : `<div class="dim">No matches.</div>`;
      document.querySelectorAll("#searchResults .row").forEach((row) =>
        row.onclick = () => chrome.tabs.create({ url: baseUrl + row.dataset.href }));
    } catch (e) { $("searchResults").innerHTML = `<div style="color:#f87171">${esc(e.message)}</div>`; }
  }, 250);
};

// ---- Ask AI ----
$("askBtn").onclick = async () => {
  const prompt = $("askInput").value.trim();
  if (!prompt) return;
  $("askReply").innerHTML = `<div class="reply muted">Thinking…</div>`;
  try {
    const d = await WB.api("/api/v1/agent", { method: "POST", body: { prompt } });
    $("askReply").innerHTML = `<div class="reply">${esc(d.reply || "Done.")}</div>`;
  } catch (e) { $("askReply").innerHTML = `<div class="reply" style="color:#f87171">${esc(e.message)}</div>`; }
};

$("gear").onclick = () => chrome.runtime.openOptionsPage();
$("setupBtn").onclick = () => chrome.runtime.openOptionsPage();

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

init();
