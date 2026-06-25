"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
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
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
    } else {
      router.push("/chat/new");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a3c5e]">DeskBot</h1>
          <p className="text-gray-500 mt-1">Create your company workspace</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Company name", field: "companyName", type: "text", placeholder: "Acme Corp" },
              { label: "Your name", field: "fullName", type: "text", placeholder: "Jane Smith" },
              { label: "Work email", field: "email", type: "email", placeholder: "you@company.com" },
              { label: "Password", field: "password", type: "password", placeholder: "••••••••" },
            ].map(({ label, field, type, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type} required
                  value={form[field as keyof typeof form]}
                  onChange={(e) => set(field, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
                  placeholder={placeholder}
                />
              </div>
            ))}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-[#1a3c5e] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a9f] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating workspace..." : "Create workspace"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-[#1a3c5e] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
