"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check, Key, Terminal, AlertTriangle } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
}

function fmtDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ApiKeysPage() {
  const [keys, setKeys]         = useState<ApiKey[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null); // raw key shown once
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    fetch("/api/v1/keys")
      .then(r => r.json())
      .then(d => setKeys(d.keys ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function createKey() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setKeys(prev => [data, ...prev]);
      setRevealed(data.raw_key);
      setNewName("");
    }
    setCreating(false);
  }

  async function revokeKey(id: string) {
    await fetch("/api/v1/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setKeys(prev => prev.filter(k => k.id !== id));
  }

  function copyKey() {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Key size={18} style={{ color: "var(--accent-purple)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>API Keys</h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Generate keys to access WorkBox from Claude Code, scripts, or any MCP client.
        </p>
      </div>

      {/* Revealed key banner */}
      {revealed && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "rgba(234,179,8,0.08)", borderColor: "rgba(234,179,8,0.3)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "#eab308" }} />
            <p className="text-xs font-semibold" style={{ color: "#eab308" }}>
              Copy this key now — it will never be shown again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono break-all"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {revealed}
            </code>
            <button onClick={copyKey}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
              style={{ background: copied ? "#22c55e" : "var(--accent-purple)", color: "white" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setRevealed(null)} className="text-xs" style={{ color: "var(--text-secondary)" }}>
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Create new key</p>
        <div className="flex gap-2">
          <input
            placeholder="Key name (e.g. Claude Code, CI pipeline)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createKey()}
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <button onClick={createKey} disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent-purple)" }}>
            <Plus size={13} /> {creating ? "Creating…" : "Generate"}
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Active keys ({keys.length})
        </p>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</p>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border py-10 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
            <Key size={24} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-secondary)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No API keys yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {keys.map(k => (
              <div key={k.id} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>
                  <Key size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{k.name}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-secondary)" }}>{k.key_prefix}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Last used</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{fmtDate(k.last_used_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Created</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{fmtDate(k.created_at)}</p>
                </div>
                <button onClick={() => revokeKey(k.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                  style={{ color: "var(--danger)" }} title="Revoke key">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP setup instructions */}
      <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Terminal size={16} style={{ color: "var(--accent-purple)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Connect Claude Code via MCP</p>
        </div>
        <ol className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ background: "rgba(124,58,237,0.2)", color: "var(--accent-purple)" }}>1</span>
            <span>Generate an API key above and copy it.</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ background: "rgba(124,58,237,0.2)", color: "var(--accent-purple)" }}>2</span>
            <div>
              <p>Clone the MCP server from your WorkBox repo and install it:</p>
              <pre className="mt-2 px-3 py-2 rounded-lg text-xs overflow-x-auto"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
{`cd workbox-mcp && npm install`}
              </pre>
            </div>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ background: "rgba(124,58,237,0.2)", color: "var(--accent-purple)" }}>3</span>
            <div>
              <p>Add to <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--bg-primary)" }}>~/.claude/settings.json</code>:</p>
              <pre className="mt-2 px-3 py-2 rounded-lg text-xs overflow-x-auto"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
{`{
  "mcpServers": {
    "workbox": {
      "command": "node",
      "args": ["/path/to/deskbot/workbox-mcp/index.js"],
      "env": {
        "WORKBOX_API_KEY": "wbx_your_key_here",
        "WORKBOX_BASE_URL": "${BASE_URL}"
      }
    }
  }
}`}
              </pre>
            </div>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ background: "rgba(124,58,237,0.2)", color: "var(--accent-purple)" }}>4</span>
            <span>Restart Claude Code. You can now ask Claude to manage your WorkBox tasks, meetings, and plans directly.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
