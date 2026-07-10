"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore, Space } from "@/store/workspace";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

const STEPS = ["Name your workspace", "Create a space", "Invite your team"];
const ICONS = ["🚀", "📦", "🎨", "📣", "⚙️", "🔬", "💼", "🎯", "🏠", "🌍"];
const COLORS = ["#7c3aed", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];

export default function OnboardingPage() {
  const router = useRouter();
  const { addSpace } = useWorkspaceStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [spaceIcon, setSpaceIcon] = useState("🚀");
  const [spaceColor, setSpaceColor] = useState("#7c3aed");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function handleWorkspaceNext() {
    if (!workspaceName.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/workspace/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });
    } catch {}
    setLoading(false);
    setStep(1);
  }

  async function handleSpaceNext() {
    const name = spaceName.trim() || "My Space";
    const spaceId = `s${Date.now()}`;
    const listId = `l${Date.now() + 1}`;
    const space: Space = {
      id: spaceId,
      name,
      icon: spaceIcon,
      color: spaceColor,
      expanded: true,
      folders: [],
      lists: [{ id: listId, name: "Tasks", space_id: spaceId, color: spaceColor, position: 0 }],
    };
    addSpace(space);
    setStep(2);
  }

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email) { skipToApp(); return; }
    setLoading(true);
    setInviteError("");
    try {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setInviteSent(true); setTimeout(skipToApp, 1500); }
      else { const d = await res.json(); setInviteError(d.error || "Failed to send invite"); }
    } catch {
      setInviteError("Something went wrong");
    }
    setLoading(false);
  }

  function skipToApp() {
    localStorage.setItem("wb_onboarded", "1");
    track("onboarding_completed");
    router.push("/home");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: "var(--accent-purple)" }}>W</div>
        <span className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>WorkBox</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? "text-white" : i === step ? "text-white" : "text-opacity-50"}`}
              style={{ background: i <= step ? "var(--accent-purple)" : "var(--border)", color: i <= step ? "white" : "var(--text-secondary)" }}>
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px" style={{ background: i < step ? "var(--accent-purple)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border p-8" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

        {/* Step 0 — Workspace name */}
        {step === 0 && (
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Welcome to WorkBox!</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Let's set up your workspace. What should we call it?</p>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Workspace name</label>
            <input autoFocus value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleWorkspaceNext()}
              placeholder="Acme Corp, My Projects..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-6"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />
            <button onClick={handleWorkspaceNext} disabled={!workspaceName.trim() || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--accent-purple)" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Continue</span><ArrowRight size={15} /></>}
            </button>
          </div>
        )}

        {/* Step 1 — Create first space */}
        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Create your first space</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Spaces are where your work lives — think Engineering, Marketing, Personal.</p>

            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Space name</label>
            <input autoFocus value={spaceName} onChange={(e) => setSpaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSpaceNext()}
              placeholder="Engineering, Marketing..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-4"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />

            <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>Icon</label>
            <div className="flex gap-2 flex-wrap mb-4">
              {ICONS.map((ic) => (
                <button key={ic} onClick={() => setSpaceIcon(ic)}
                  className="w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all"
                  style={{ background: spaceIcon === ic ? "rgba(124,58,237,0.2)" : "var(--bg-primary)", border: spaceIcon === ic ? "2px solid var(--accent-purple)" : "2px solid transparent" }}>
                  {ic}
                </button>
              ))}
            </div>

            <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex gap-2 mb-6">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setSpaceColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: spaceColor === c ? "white" : "transparent" }} />
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={skipToApp} className="flex-1 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                Skip
              </button>
              <button onClick={handleSpaceNext}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--accent-purple)" }}>
                <span>Continue</span><ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Invite */}
        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Invite your team</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>WorkBox is better with teammates. You can always do this later.</p>

            {inviteSent ? (
              <div className="text-center py-6">
                <CheckCircle2 size={36} className="mx-auto mb-3" style={{ color: "#22c55e" }} />
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>Invite sent!</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Taking you to your workspace...</p>
              </div>
            ) : (
              <>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Email address</label>
                <input autoFocus value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="teammate@company.com"
                  type="email"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-2"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
                {inviteError && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{inviteError}</p>}

                <div className="flex gap-2 mt-4">
                  <button onClick={skipToApp} className="flex-1 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    Skip for now
                  </button>
                  <button onClick={handleInvite} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--accent-purple)" }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Send invite</span><ArrowRight size={15} /></>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs mt-6" style={{ color: "var(--text-secondary)" }}>
        Step {step + 1} of {STEPS.length}
      </p>
    </div>
  );
}
