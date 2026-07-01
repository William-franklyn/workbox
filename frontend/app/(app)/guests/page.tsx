"use client";
import { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { Plus, Trash2, Loader2, UserCheck, Clock, X, Link2, Shield, Eye } from "lucide-react";

interface Guest {
  id: string;
  email: string;
  role: string;
  spaces: string[];
  accepted: boolean;
  expires_at: string;
  created_at: string;
  invite_url?: string;
  inviter?: { full_name: string };
}

const ROLES = [
  { value: "guest", label: "Guest", desc: "Can view and comment on assigned spaces", icon: <UserCheck size={14} /> },
  { value: "viewer", label: "Viewer", desc: "Read-only access, cannot comment", icon: <Eye size={14} /> },
];

function timeLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3600000);
  return `${hours}h left`;
}

export default function GuestsPage() {
  const { spaces } = useWorkspaceStore();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: "", role: "guest", spaces: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guest").then((r) => r.json()).then((d) => setGuests(d.guests ?? [])).finally(() => setLoading(false));
  }, []);

  async function invite() {
    if (!form.email.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.guest) {
        setGuests((g) => [{ ...data.guest, invite_url: data.invite_url }, ...g]);
        setLastInviteUrl(data.invite_url);
        setForm({ email: "", role: "guest", spaces: [] });
        setInviting(false);
      }
    } finally { setSaving(false); }
  }

  async function revoke(id: string) {
    setGuests((g) => g.filter((x) => x.id !== id));
    await fetch(`/api/guest?id=${id}`, { method: "DELETE" });
  }

  function copyLink(guest: Guest) {
    const url = `${window.location.origin}/invite/${guest.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(guest.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function toggleSpace(spaceId: string) {
    setForm((f) => ({
      ...f,
      spaces: f.spaces.includes(spaceId) ? f.spaces.filter((s) => s !== spaceId) : [...f.spaces, spaceId],
    }));
  }

  const active = guests.filter((g) => g.accepted).length;
  const pending = guests.filter((g) => !g.accepted).length;

  return (
    <div className="overflow-y-auto h-full p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Guest Access</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {active} active · {pending} pending invitation{pending !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setInviting(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={14} /> Invite guest
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
        style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
        <Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent-purple)" }} />
        <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>Guests</strong> can access only the spaces you assign them and cannot see billing, settings, or other members.
          <strong style={{ color: "var(--text-primary)" }}> Viewers</strong> have read-only access and cannot comment or create tasks.
          Invites expire after 7 days if not accepted.
        </div>
      </div>

      {/* Last invite URL banner */}
      {lastInviteUrl && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <UserCheck size={14} style={{ color: "var(--success)" }} />
          <span className="text-xs flex-1" style={{ color: "var(--success)" }}>Invite sent! Share this link: <span className="font-mono">{lastInviteUrl}</span></span>
          <button onClick={() => setLastInviteUrl(null)} style={{ color: "var(--text-secondary)" }}><X size={13} /></button>
        </div>
      )}

      {/* Invite form */}
      {inviting && (
        <div className="rounded-xl p-5 mb-6 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Invite a guest</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Email address</label>
              <input autoFocus value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && invite()}
                placeholder="guest@company.com" type="email"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </div>

            <div>
              <label className="text-xs mb-2 block" style={{ color: "var(--text-secondary)" }}>Access level</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button key={r.value} onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                    className="text-left p-3 rounded-lg border transition-colors"
                    style={{
                      background: form.role === r.value ? "rgba(124,58,237,0.12)" : "var(--bg-primary)",
                      borderColor: form.role === r.value ? "var(--accent-purple)" : "var(--border)",
                    }}>
                    <div className="flex items-center gap-2 mb-1" style={{ color: form.role === r.value ? "var(--accent-purple)" : "var(--text-primary)" }}>
                      {r.icon}<span className="text-xs font-semibold">{r.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {spaces.length > 0 && (
              <div>
                <label className="text-xs mb-2 block" style={{ color: "var(--text-secondary)" }}>
                  Space access <span style={{ color: "var(--text-secondary)" }}>(leave empty to grant all)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {spaces.map((s) => (
                    <button key={s.id} onClick={() => toggleSpace(s.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors border"
                      style={{
                        background: form.spaces.includes(s.id) ? `${s.color}22` : "var(--bg-primary)",
                        borderColor: form.spaces.includes(s.id) ? s.color : "var(--border)",
                        color: form.spaces.includes(s.id) ? s.color : "var(--text-secondary)",
                      }}>
                      <span>{s.icon}</span>{s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={() => setInviting(false)}
              className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={invite} disabled={saving || !form.email.trim()}
              className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ background: "var(--accent-purple)" }}>
              {saving && <Loader2 size={11} className="animate-spin" />}
              Send invite
            </button>
          </div>
        </div>
      )}

      {/* Guest list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : guests.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <UserCheck size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No guests yet</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Invite clients or collaborators with limited access</p>
          <button onClick={() => setInviting(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--accent-purple)" }}>
            <Plus size={14} className="inline mr-1.5" />Invite guest
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {guests.map((g) => (
            <div key={g.id} className="rounded-xl border p-4 flex items-center gap-4"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: g.accepted ? "rgba(34,197,94,0.15)" : "rgba(124,58,237,0.15)", color: g.accepted ? "var(--success)" : "var(--accent-purple)" }}>
                {g.email[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{g.email}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                    {g.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs flex items-center gap-1" style={{ color: g.accepted ? "var(--success)" : "var(--text-secondary)" }}>
                    {g.accepted ? <><UserCheck size={10} /> Accepted</> : <><Clock size={10} /> {timeLeft(g.expires_at)}</>}
                  </span>
                  {g.inviter && (
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>invited by {g.inviter.full_name}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!g.accepted && (
                  <button onClick={() => copyLink(g)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: copiedId === g.id ? "var(--success)" : "var(--text-secondary)" }}>
                    <Link2 size={11} />
                    {copiedId === g.id ? "Copied!" : "Copy link"}
                  </button>
                )}
                <button onClick={() => revoke(g.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  style={{ color: "var(--danger)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
