"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { identify, track } from "@/lib/analytics";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      console.log("[login] attempting signIn for:", email);
      const supabase = createClient();
      console.log("[login] supabase client created");

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      console.log("[login] result:", {
        userId: data?.user?.id,
        session: !!data?.session,
        error: authError ? { message: authError.message, status: authError.status, code: (authError as any).code } : null,
      });

      if (authError) {
        setError(authError.message || JSON.stringify(authError));
        setLoading(false);
        return;
      }

      console.log("[login] success — redirecting to /home");
      if (data?.user?.id) identify(data.user.id, { email });
      track("login_completed");
      window.location.href = "/home";
    } catch (err: any) {
      console.error("[login] caught exception:", err);
      setError(err?.message || String(err) || "Unexpected error — check console.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white mx-auto mb-4" style={{ background: "var(--accent-purple)" }}>W</div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Sign in to your WorkBox</p>
        </div>

        <div className="rounded-2xl p-6 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Email", value: email, onChange: setEmail, type: "email", placeholder: "you@company.com" },
              { label: "Password", value: password, onChange: setPassword, type: "password", placeholder: "••••••••" },
            ].map(({ label, value, onChange, type, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
                <input
                  type={type} required value={value} placeholder={placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
              </div>
            ))}

            {error && (
              <p className="text-xs p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                {typeof error === "string" ? error : JSON.stringify(error)}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent-purple)" }}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs mt-4" style={{ color: "var(--text-secondary)" }}>
            No account?{" "}
            <Link href="/signup" className="font-medium hover:underline" style={{ color: "var(--accent-purple)" }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
