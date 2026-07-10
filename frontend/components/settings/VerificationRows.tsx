"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import { track } from "@/lib/analytics";

function VerifiedChip() {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: "rgba(74,222,128,0.12)", color: "var(--success)" }}>
      <BadgeCheck size={12} /> Verified
    </span>
  );
}

function UnverifiedChip() {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: "rgba(251,191,36,0.12)", color: "var(--warning)" }}>
      <ShieldAlert size={12} /> Not verified
    </span>
  );
}

/**
 * Email row. Sends Supabase's default magic-link email (no custom SMTP
 * needed); the user clicks the link, which lands on /verify-email. A code
 * input is kept as fallback for projects whose template shows a token.
 */
export function EmailVerification() {
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [stage, setStage] = useState<"idle" | "sending" | "entering" | "confirming">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const emailPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/email-verification").then(r => r.json()).then(d => {
      setEmail(d.email ?? "");
      setVerified(!!d.email_verified);
    }).catch(() => setVerified(false));
    return () => { if (emailPollRef.current) clearInterval(emailPollRef.current); };
  }, []);

  async function send() {
    setStage("sending"); setError(null);
    const res = await fetch("/api/email-verification", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? "Couldn't send the email."); setStage("idle"); return; }
    setStage("entering");
    // Flip the chip live once the link is clicked (possibly in another tab)
    if (emailPollRef.current) clearInterval(emailPollRef.current);
    emailPollRef.current = setInterval(async () => {
      const s = await fetch("/api/email-verification").then(r => r.json()).catch(() => null);
      if (s?.email_verified) {
        setVerified(true); setStage("idle");
        track("email_verified");
        if (emailPollRef.current) clearInterval(emailPollRef.current);
      }
    }, 3000);
  }

  async function confirm() {
    setStage("confirming"); setError(null);
    const res = await fetch("/api/email-verification", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", token: code }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? "Invalid code."); setStage("entering"); return; }
    setVerified(true); setStage("idle"); setCode("");
  }

  return (
    <div className="py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Email</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{email}</p>
        </div>
        <div className="flex items-center gap-2">
          {verified === null ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
            : verified ? <VerifiedChip />
            : (
              <>
                <UnverifiedChip />
                {stage === "idle" && (
                  <button onClick={send} className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                    style={{ background: "var(--accent-purple)" }}>
                    Verify email
                  </button>
                )}
                {stage === "sending" && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />}
              </>
            )}
        </div>
      </div>

      {(stage === "entering" || stage === "confirming") && !verified && (
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
          <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
            📬 We emailed a verification link to <strong>{email}</strong> — open it and click the link.
          </p>
          <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <Loader2 size={11} className="animate-spin" /> Waiting… check spam if you don't see it.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Got a code instead?" inputMode="numeric"
              className="w-40 px-3 py-1.5 rounded-lg text-xs outline-none tracking-widest"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <button onClick={confirm} disabled={code.length !== 6 || stage === "confirming"}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-40"
              style={{ background: "var(--accent-purple)" }}>
              {stage === "confirming" ? "Checking…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

/**
 * Phone row: reverse OTP over WhatsApp. The user sends "VERIFY <code>" to the
 * bot; WhatsApp attests the sender's number, so the link is trustworthy and
 * free (user-initiated message).
 */
export function PhoneVerification() {
  const [phone, setPhone] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [pending, setPending] = useState<{ code: string; wa_link: string | null; bot_number: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refresh() {
    return fetch("/api/phone-verification").then(r => r.json()).then(d => {
      setPhone(d.phone_number);
      setVerified(!!d.phone_verified);
      return d;
    });
  }

  useEffect(() => {
    refresh().catch(() => setVerified(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function start() {
    setBusy(true);
    const res = await fetch("/api/phone-verification", { method: "POST" });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return;
    setPending(d);
    // Poll until the webhook confirms the bind
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await refresh();
      if (s.phone_verified) {
        setPending(null);
        track("whatsapp_verified");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
  }

  async function unlink() {
    setBusy(true);
    await fetch("/api/phone-verification", { method: "DELETE" });
    await refresh();
    setBusy(false);
  }

  return (
    <div className="py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>WhatsApp / phone</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {verified && phone ? phone : "Chat with the WorkBox Agent on WhatsApp"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {verified === null ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
            : verified ? (
              <>
                <VerifiedChip />
                <button onClick={unlink} disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Unlink
                </button>
              </>
            ) : !pending && (
              <button onClick={start} disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                style={{ background: "#25D366" }}>
                <MessageCircle size={13} /> {busy ? "…" : "Verify via WhatsApp"}
              </button>
            )}
        </div>
      </div>

      {pending && !verified && (
        <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
          <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
            Send this message to the WorkBox bot on WhatsApp{pending.bot_number ? ` (+${pending.bot_number})` : ""}:
          </p>
          <p className="text-lg font-mono font-bold tracking-wider my-2 select-all" style={{ color: "var(--accent-purple)" }}>
            VERIFY {pending.code}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {pending.wa_link && (
              <a href={pending.wa_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                style={{ background: "#25D366" }}>
                <MessageCircle size={13} /> Open WhatsApp
              </a>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Loader2 size={12} className="animate-spin" /> Waiting for your message… code expires in 15 min
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
