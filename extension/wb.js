/* Shared WorkBox API client for the extension (background + popup + options). */
const WB = {
  DEFAULT_BASE: "https://workbox-blue.vercel.app",

  async getConfig() {
    const s = await chrome.storage.sync.get(["baseUrl", "apiKey"]);
    return {
      baseUrl: (s.baseUrl || WB.DEFAULT_BASE).replace(/\/+$/, ""),
      apiKey: s.apiKey || "",
    };
  },

  async api(path, opts = {}) {
    const { baseUrl, apiKey } = await WB.getConfig();
    if (!apiKey) throw new Error("Set your WorkBox API key in the extension options.");
    const res = await fetch(baseUrl + path, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await res.text();
    let data;
    try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
};
if (typeof self !== "undefined") self.WB = WB;
