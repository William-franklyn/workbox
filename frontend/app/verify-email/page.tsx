"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Loader2, XCircle } from "lucide-react";

/**
 * Landing page for the Supabase magic-link verification email.
 * The link arrives with tokens in the URL hash (implicit flow); we hand the
 * access token to the server, which validates it and marks the email verified.
 */
export default function VerifyEmailPage() {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const errDesc = hash.get("error_description");

    if (errDesc) {
      setState("error");
      setMessage(decodeURIComponent(errDesc.replace(/\+/g, " ")));
      return;
    }
    if (!accessToken) {
      setState("error");
      setMessage("This link is missing its token — it may have been opened already. Request a new one from Settings.");
      return;
    }

    fetch("/api/email-verification", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) {
          setState("done");
          setMessage("Your email is verified.");
        } else {
          setState("error");
          setMessage(d.error ?? "Verification failed.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Couldn't reach the server. Try the link again.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        {state === "working" && <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: "var(--accent-purple)" }} />}
        {state === "done" && <BadgeCheck size={36} className="mx-auto mb-4" style={{ color: "var(--success)" }} />}
        {state === "error" && <XCircle size={36} className="mx-auto mb-4" style={{ color: "var(--danger)" }} />}

        <h1 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {state === "done" ? "Email verified 🎉" : state === "error" ? "Verification failed" : "One moment"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{message}</p>

        <Link href="/settings" className="inline-block px-5 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "var(--accent-purple)" }}>
          Back to Settings
        </Link>
      </div>
    </div>
  );
}
