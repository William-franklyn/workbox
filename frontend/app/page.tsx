import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <Image src="/logo-dark.svg" alt="WorkBox" width={120} height={40} priority />
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">
            Log in
          </Link>
          <Link href="/signup" className="text-sm bg-[#1a3c5e] text-white px-4 py-2 rounded-lg hover:bg-[#2d6a9f] transition-colors">
            Get Started Free
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="inline-block bg-blue-50 text-[#1a3c5e] text-sm font-medium px-3 py-1 rounded-full mb-6">
          AI-Powered · Secure · Private
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Your company knowledge,<br />
          <span className="text-[#1a3c5e]">instantly answered</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          WorkBox reads your internal documents — HR policies, procedures, manuals — and lets every employee get instant, accurate answers without bothering HR or management.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="bg-[#1a3c5e] text-white px-8 py-3 rounded-lg text-base font-semibold hover:bg-[#2d6a9f] transition-colors">
            Start for free
          </Link>
          <Link href="/login" className="border border-gray-200 text-gray-700 px-8 py-3 rounded-lg text-base font-semibold hover:bg-gray-50 transition-colors">
            Sign in
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: "Upload any document", desc: "PDF, Word, or text files. WorkBox reads your HR manuals, policies, and guides instantly." },
          { title: "Ask anything", desc: "Employees type natural questions and get precise answers from your actual company documents." },
          { title: "Secure by design", desc: "Each company's data is completely isolated. No cross-tenant data access, ever." },
        ].map((f) => (
          <div key={f.title} className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="text-center text-sm text-gray-400 py-10 border-t border-gray-100">
        © {new Date().getFullYear()} WorkBox. Built for modern teams.
      </footer>
    </main>
  );
}
