"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [form, setForm] = useState({ companyName: "", fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            company_name: form.companyName,
            role: "admin",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError("Check your email for a confirmation link, then sign in.");
        setLoading(false);
        return;
      }

      // Set organization_id now that we have the user ID — trigger sets role from metadata
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: data.user!.id,
        email: form.email,
        full_name: form.fullName,
        role: "admin",
        organization_id: data.user!.id,
      });

      if (upsertError) {
        setError("Account created but profile setup failed: " + upsertError.message);
        setLoading(false);
        return;
      }

      window.location.href = "/home";
    } catch (err: any) {
      setError(err?.message || "Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  const fields = [
    { label: "Company or workspace name", field: "companyName", type: "text", placeholder: "Acme Corp" },
    { label: "Your name", field: "fullName", type: "text", placeholder: "Jane Smith" },
    { label: "Work email", field: "email", type: "email", placeholder: "you@company.com" },
    { label: "Password", field: "password", type: "password", placeholder: "••••••••", autoComplete: "new-password" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white mx-auto mb-4" style={{ background: "var(--accent-purple)" }}>W</div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Create your workspace</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Get started with WorkBox for free</p>
        </div>

        <div className="rounded-2xl p-6 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ label, field, type, placeholder, autoComplete }) => (
              <div key={field}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
                <input
                  type={type}
                  required
                  autoComplete={autoComplete}
                  value={form[field as keyof typeof form]}
                  placeholder={placeholder}
                  onChange={(e) => set(field, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
              </div>
            ))}

            {error && (
              <p className="text-xs p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent-purple)" }}>
              {loading ? "Creating workspace..." : "Create workspace"}
            </button>
          </form>

          <p className="text-center text-xs mt-4" style={{ color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent-purple)" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
