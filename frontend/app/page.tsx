import Link from "next/link";
import PublicChatWidget from "@/components/ai/PublicChatWidget";

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--accent-purple)" }}>W</div>
          <span className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>WorkBox</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm px-4 py-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            Sign in
          </Link>
          <Link href="/signup" className="text-sm px-4 py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90" style={{ background: "var(--accent-purple)" }}>
            Get Started Free
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-8 py-28 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8 border" style={{ background: "rgba(124,58,237,0.1)", borderColor: "rgba(124,58,237,0.3)", color: "var(--accent-purple)" }}>
          ✦ AI-Powered Productivity Platform
        </div>
        <h1 className="text-5xl font-bold leading-tight mb-6" style={{ color: "var(--text-primary)" }}>
          All your work,<br />
          <span style={{ color: "var(--accent-purple)" }}>one beautiful place</span>
        </h1>
        <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
          Tasks, docs, goals, and AI — all in one fast, beautiful workspace. Built for teams that want to move faster without the chaos.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="px-8 py-3 rounded-xl text-base font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "var(--accent-purple)" }}>
            Start for free
          </Link>
          <Link href="/login" className="px-8 py-3 rounded-xl text-base font-semibold transition-colors hover:bg-white/5" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            Sign in
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 pb-20 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: "⚡", title: "Task Management", desc: "List, Kanban, Calendar, and Table views. Drag, drop, and organize everything." },
          { icon: "🤖", title: "AI Assistant", desc: "Ask anything about your workspace. Get instant answers powered by Groq." },
          { icon: "📊", title: "Goals & Dashboards", desc: "Track progress with beautiful widgets and key results linked to your work." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl p-6 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
          </div>
        ))}
      </section>

      <PublicChatWidget />

      <footer className="text-center text-xs py-8 border-t" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        <p>© {new Date().getFullYear()} WorkBox. Built for modern teams.</p>
        <div className="flex justify-center gap-6 mt-2">
          <Link href="/privacy" style={{ color: "var(--text-secondary)" }} className="hover:underline">Privacy Policy</Link>
        </div>
      </footer>
    </main>
  );
}
