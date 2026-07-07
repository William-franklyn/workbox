"use client";
import { useEffect, useState } from "react";
import { User, Building2, Bell, Shield, Palette, Users, Mail, Loader2, Crown, Trash2 } from "lucide-react";

type Tab = "profile" | "workspace" | "members" | "notifications" | "security" | "appearance";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "members", label: "Members", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
];

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{description}</p>}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors"
      style={{ background: checked ? "var(--accent-purple)" : "var(--border)" }}>
      <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }} />
    </button>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg text-sm outline-none w-64"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
      onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
      onBlur={(e) => e.target.style.borderColor = "var(--border)"}
    />
  );
}

interface Member { id: string; full_name: string; role: string; created_at: string; }

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [saved, setSaved] = useState(false);

  // Profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (d.full_name) setFullName(d.full_name);
      if (d.email) setEmail(d.email);
      if (d.phone_number) setPhoneNumber(d.phone_number);
    }).catch(() => {});
  }, []);

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tab === "members" && !membersLoaded) {
      fetch("/api/members").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setMembers(d); setMembersLoaded(true); }).catch(() => setMembersLoaded(true));
    }
  }, [tab, membersLoaded]);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg(""); setInviteLink(""); setInviteSuccess(false);
    const res = await fetch("/api/members/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail }) });
    const d = await res.json();
    if (res.ok) {
      setInviteSuccess(true);
      if (d.existing) {
        setInviteMsg("Added to your workspace! They can log in and access it now.");
      } else {
        setInviteMsg("Invite sent! Share this link if they don't receive the email:");
        setInviteLink(d.link || "");
      }
      setInviteEmail("");
    } else {
      setInviteSuccess(false);
      setInviteMsg(d.error || "Failed to send invite");
    }
    setInviting(false);
  }

  // Workspace state
  const [workspaceName, setWorkspaceName] = useState("My Workspace");

  // Notifications state
  const [notifs, setNotifs] = useState({ email: true, desktop: false, mentions: true, updates: false });

  // Appearance
  const [accentColor, setAccentColor] = useState(() =>
    (typeof window !== "undefined" && localStorage.getItem("wb_accent_color")) || "#7c3aed"
  );

  function applyAccent(color: string) {
    setAccentColor(color);
    document.documentElement.style.setProperty("--accent-purple", color);
    localStorage.setItem("wb_accent_color", color);
  }

  async function saveSettings() {
    if (tab === "profile") {
      await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: fullName, phone_number: phoneNumber }) });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar tabs */}
      <div className="w-48 shrink-0 border-r p-3" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide px-3 mb-2" style={{ color: "var(--text-secondary)" }}>Settings</p>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors mb-0.5"
            style={{
              background: tab === id ? "rgba(124,58,237,0.12)" : "transparent",
              color: tab === id ? "var(--accent-purple)" : "var(--text-secondary)",
              fontWeight: tab === id ? 500 : 400,
            }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-xl">
          {tab === "profile" && (
            <>
              <h1 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Profile</h1>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: "var(--accent-purple)" }}>{fullName[0]}</div>
                <div>
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>{fullName}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{email}</p>
                </div>
              </div>
              <SettingRow label="Full name"><Input value={fullName} onChange={setFullName} placeholder="Your name" /></SettingRow>
              <SettingRow label="Email" description="Contact support to change your email"><span className="text-sm" style={{ color: "var(--text-secondary)" }}>{email}</span></SettingRow>
              <SettingRow label="Bio" description="Tell your team about yourself"><Input value={bio} onChange={setBio} placeholder="A short bio..." /></SettingRow>
              <SettingRow label="Phone number" description="Used for SMS access to WorkBox Agent via Twilio"><Input value={phoneNumber} onChange={setPhoneNumber} placeholder="+12345678901" /></SettingRow>
            </>
          )}

          {tab === "workspace" && (
            <>
              <h1 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Workspace</h1>
              <SettingRow label="Workspace name"><Input value={workspaceName} onChange={setWorkspaceName} /></SettingRow>
              <SettingRow label="Plan" description="Current subscription plan">
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>Free</span>
              </SettingRow>
              <SettingRow label="Members" description="People in your workspace">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>1 member</span>
              </SettingRow>
            </>
          )}

          {tab === "members" && (
            <>
              <h1 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Members</h1>

              {/* Invite box */}
              <div className="rounded-xl p-4 mb-6 border" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Invite a teammate</p>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                    placeholder="colleague@company.com" type="email"
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                  />
                  <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--accent-purple)" }}>
                    {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    Invite
                  </button>
                </div>
                {inviteMsg && <p className="text-xs mt-2" style={{ color: inviteSuccess ? "#22c55e" : "var(--danger)" }}>{inviteMsg}</p>}
                {inviteLink && (
                  <div className="mt-2 flex items-center gap-2">
                    <input readOnly value={inviteLink} className="flex-1 px-2 py-1 rounded text-xs outline-none" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }} />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink).catch(() => {
                          const el = document.createElement("textarea");
                          el.value = inviteLink;
                          document.body.appendChild(el);
                          el.select();
                          document.execCommand("copy");
                          document.body.removeChild(el);
                        });
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-2 py-1 rounded text-xs font-medium text-white shrink-0"
                      style={{ background: "var(--accent-purple)" }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>

              {/* Members list */}
              {!membersLoaded ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
              ) : members.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>No members yet. Invite someone above.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: "var(--accent-purple)" }}>
                        {(m.full_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.full_name || "Unnamed"}</p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Joined {new Date(m.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: m.role === "admin" ? "rgba(124,58,237,0.15)" : "var(--bg-secondary)", color: m.role === "admin" ? "var(--accent-purple)" : "var(--text-secondary)" }}>
                        {m.role === "admin" && <Crown size={10} />}{m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "notifications" && (
            <>
              <h1 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Notifications</h1>
              <SettingRow label="Email notifications" description="Receive task updates via email">
                <Toggle checked={notifs.email} onChange={(v) => setNotifs((n) => ({ ...n, email: v }))} />
              </SettingRow>
              <SettingRow label="Desktop notifications" description="Browser push notifications">
                <Toggle checked={notifs.desktop} onChange={(v) => setNotifs((n) => ({ ...n, desktop: v }))} />
              </SettingRow>
              <SettingRow label="Mentions" description="Notify when someone mentions you">
                <Toggle checked={notifs.mentions} onChange={(v) => setNotifs((n) => ({ ...n, mentions: v }))} />
              </SettingRow>
              <SettingRow label="Product updates" description="News and tips from WorkBox">
                <Toggle checked={notifs.updates} onChange={(v) => setNotifs((n) => ({ ...n, updates: v }))} />
              </SettingRow>
            </>
          )}

          {tab === "security" && (
            <>
              <h1 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Security</h1>
              <SettingRow label="Password" description="Last changed: never">
                <button className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  Change password
                </button>
              </SettingRow>
              <SettingRow label="Two-factor authentication" description="Add an extra layer of security">
                <button className="text-xs px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent-purple)" }}>
                  Enable 2FA
                </button>
              </SettingRow>
              <SettingRow label="Active sessions" description="Devices signed into your account">
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>1 session</span>
              </SettingRow>
            </>
          )}

          {tab === "appearance" && (
            <>
              <h1 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Appearance</h1>
              <SettingRow label="Theme" description="WorkBox always uses dark mode">
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Dark</span>
              </SettingRow>
              <SettingRow label="Accent color" description="Primary color for buttons and highlights">
                <div className="flex items-center gap-2">
                  {["#7c3aed", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"].map((c) => (
                    <button key={c} onClick={() => applyAccent(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: accentColor === c ? "white" : "transparent" }} />
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Sidebar width" description="Default sidebar size">
                <select className="text-xs px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <option>Normal (240px)</option>
                  <option>Wide (280px)</option>
                  <option>Compact (200px)</option>
                </select>
              </SettingRow>
            </>
          )}

          <div className="mt-8 flex items-center gap-3">
            <button onClick={saveSettings}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-purple)" }}>
              {saved ? "Saved!" : "Save changes"}
            </button>
            {saved && <span className="text-xs" style={{ color: "#22c55e" }}>Changes saved successfully</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
