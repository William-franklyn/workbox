async function load() {
  const { baseUrl, apiKey } = await WB.getConfig();
  document.getElementById("baseUrl").value = baseUrl;
  document.getElementById("apiKey").value = apiKey;
}

document.getElementById("save").addEventListener("click", async () => {
  const baseUrl = document.getElementById("baseUrl").value.trim() || WB.DEFAULT_BASE;
  const apiKey = document.getElementById("apiKey").value.trim();
  await chrome.storage.sync.set({ baseUrl, apiKey });
  const st = document.getElementById("status");
  st.textContent = "Testing…";
  st.style.color = "#9aa0b0";
  try {
    await WB.api("/api/v1/status");
    st.textContent = "✓ Connected";
    st.style.color = "#16a34a";
  } catch (e) {
    st.textContent = "✕ " + e.message;
    st.style.color = "#f87171";
  }
});

load();
