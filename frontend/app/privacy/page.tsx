import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — WorkBox",
  description: "How WorkBox collects, uses, and protects your data.",
};

const LAST_UPDATED = "June 30, 2026";
const CONTACT_EMAIL = "williamfranklyn2020@gmail.com";
const COMPANY_NAME = "WorkBox";
const APP_URL = "https://workbox-blue.vercel.app";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--accent-purple)" }}>W</div>
          <span className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>WorkBox</span>
        </Link>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm px-4 py-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Sign in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 rounded-lg font-medium text-white" style={{ background: "var(--accent-purple)" }}>Get Started Free</Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>
            🔒 Data Protection First
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Privacy Policy</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            At {COMPANY_NAME}, your privacy is not an afterthought — it is the foundation of how we build. This policy explains exactly what data we collect, why we collect it, and how we protect it. We believe in plain language, not legal fog.
          </p>
        </div>

        <div className="space-y-12">
          <Section title="1. Who We Are">
            <p>
              {COMPANY_NAME} is a productivity and project management platform built for teams and individuals. We operate at <a href={APP_URL} className="underline" style={{ color: "var(--accent-purple)" }}>{APP_URL}</a>. When this policy says "we," "us," or "our," it means {COMPANY_NAME}. When it says "you" or "your," it means you — the person using our platform.
            </p>
            <p className="mt-3">
              If you have any questions about this policy, email us at <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-purple)" }}>{CONTACT_EMAIL}</a>. We respond within 72 hours.
            </p>
          </Section>

          <Section title="2. Our Core Commitment">
            <Callout>
              <strong>We do not sell your data. Ever.</strong> Not to advertisers, data brokers, third-party marketers, or anyone else. Your data is yours. We are a software company — our business model is building tools people love, not monetising the information inside them.
            </Callout>
          </Section>

          <Section title="3. What Data We Collect">
            <p className="mb-4" style={{ color: "var(--text-secondary)" }}>We collect only what is necessary to provide the service. Here is a full breakdown:</p>

            <SubSection title="3.1 Account Information">
              <ul>
                <li><strong>Email address</strong> — to create your account, send you product updates, and allow password recovery.</li>
                <li><strong>Full name</strong> — to personalise your workspace and identify you to teammates.</li>
                <li><strong>Password</strong> — stored as a one-way cryptographic hash (we never see your actual password).</li>
                <li><strong>Role</strong> — whether you are an admin or member, used to control workspace permissions.</li>
              </ul>
            </SubSection>

            <SubSection title="3.2 Workspace Data">
              <ul>
                <li><strong>Tasks, lists, and spaces</strong> — the work you create and organise inside WorkBox.</li>
                <li><strong>Documents and spreadsheets</strong> — files you create or upload to your workspace.</li>
                <li><strong>Goals and key results</strong> — your OKRs and progress tracking data.</li>
                <li><strong>Team chat messages</strong> — messages sent between members of your workspace.</li>
                <li><strong>Time logs and comments</strong> — time entries and task discussions.</li>
                <li><strong>Notifications</strong> — activity alerts generated by your workspace activity.</li>
              </ul>
            </SubSection>

            <SubSection title="3.3 Integration Data">
              <ul>
                <li><strong>Google Calendar</strong> — if you connect your Google account, we store an OAuth access token and refresh token to read and write your calendar events on your behalf. We only access calendar data when you explicitly request it inside WorkBox. You can disconnect this at any time from Settings.</li>
                <li><strong>API keys</strong> — if you generate API keys for third-party integrations, we store a one-way hash of the key (not the key itself) for authentication purposes.</li>
              </ul>
            </SubSection>

            <SubSection title="3.4 Usage and Technical Data">
              <ul>
                <li><strong>Log data</strong> — IP address, browser type, pages visited, and timestamps, used for security monitoring and debugging.</li>
                <li><strong>Device information</strong> — operating system and browser version, used to ensure compatibility.</li>
                <li><strong>Feature usage patterns</strong> — which features you use and how often, used to improve the product (see Section 4).</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="4. How We Use Your Data">
            <p className="mb-4" style={{ color: "var(--text-secondary)" }}>We use your data for three purposes — and only these three:</p>
            <div className="space-y-4">
              <UsageCard
                icon="⚙️"
                title="To provide the service"
                description="Authenticating your account, saving your work, syncing your data across devices, and enabling collaboration with your team. Without this, WorkBox cannot function."
              />
              <UsageCard
                icon="📈"
                title="To improve the product"
                description="We analyse aggregated, anonymised usage patterns to understand which features are valuable and which need work. For example: if 80% of users never open the Gantt view, we investigate why. This data is never linked back to individual users in our analysis."
              />
              <UsageCard
                icon="📣"
                title="To communicate with you"
                description="We may send you product announcements, new feature updates, tips, and occasional promotional offers about WorkBox. Every marketing email includes a one-click unsubscribe link. We do not share your email with third-party marketers."
              />
            </div>
          </Section>

          <Section title="5. What We Never Do">
            <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
              {[
                "Sell your personal data or workspace content to any third party",
                "Share your data with advertisers",
                "Use your workspace content to train AI models — your content is processed in real-time by the WorkBox Agent to answer your queries (inference), but never used to update or fine-tune any model's weights",
                "Access your workspace data except when required to provide support (with your permission) or to comply with a valid legal order",
                "Send you marketing emails if you have unsubscribed",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }}>✗</span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{item}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="6. Data Storage and Security">
            <p>
              Your data is stored on <strong>Supabase</strong> (PostgreSQL), hosted on AWS infrastructure with encryption at rest and in transit (TLS 1.2+). We implement the following security controls:
            </p>
            <ul className="mt-3">
              <li><strong>Row-level security (RLS)</strong> — database-enforced rules ensure users can only access their own organisation&apos;s data.</li>
              <li><strong>API key hashing</strong> — API keys are stored as SHA-256 hashes; the raw key is never stored.</li>
              <li><strong>Password hashing</strong> — passwords are hashed using bcrypt via Supabase Auth.</li>
              <li><strong>HTTPS everywhere</strong> — all data in transit is encrypted.</li>
              <li><strong>Access controls</strong> — internal access to production data is restricted to essential personnel only.</li>
            </ul>
            <p className="mt-4">
              Despite these measures, no system is 100% secure. If you discover a security vulnerability, please report it immediately to <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-purple)" }}>{CONTACT_EMAIL}</a> before disclosing it publicly. We take security reports seriously and respond within 24 hours.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <ul>
              <li><strong>Active accounts</strong> — your data is retained for as long as your account exists.</li>
              <li><strong>Deleted accounts</strong> — when you delete your account, your personal data and workspace content are permanently deleted within 30 days.</li>
              <li><strong>Backups</strong> — encrypted backups may retain deleted data for up to 90 days before being purged.</li>
              <li><strong>Log data</strong> — server logs are retained for 90 days for security and debugging purposes.</li>
            </ul>
          </Section>

          <Section title="8. Third-Party Services">
            <p className="mb-3" style={{ color: "var(--text-secondary)" }}>We use a small number of trusted third-party services to operate WorkBox:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 pr-4" style={{ color: "var(--text-secondary)" }}>Service</th>
                    <th className="text-left py-2 pr-4" style={{ color: "var(--text-secondary)" }}>Purpose</th>
                    <th className="text-left py-2" style={{ color: "var(--text-secondary)" }}>Data shared</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Supabase", "Database and authentication", "All workspace data (stored, not shared)"],
                    ["Vercel", "Hosting and deployment", "Server logs, IP addresses"],
                    ["Groq", "AI assistant responses", "Your messages and any workspace content retrieved during an AI query (tasks, docs, etc.)"],
                    ["Google", "Calendar integration (optional)", "Calendar events (only if you connect)"],
                  ].map(([service, purpose, data], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-3 pr-4 font-medium">{service}</td>
                      <td className="py-3 pr-4" style={{ color: "var(--text-secondary)" }}>{purpose}</td>
                      <td className="py-3" style={{ color: "var(--text-secondary)" }}>{data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              We select providers whose published terms prohibit using API data for their own training or advertising purposes. We cannot guarantee third-party behaviour beyond our contractual agreements — we encourage you to review each provider&apos;s privacy policy directly. We do not use any advertising networks or tracking pixels.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <p className="mb-4" style={{ color: "var(--text-secondary)" }}>You have the following rights regarding your data. To exercise any of them, email <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-purple)" }}>{CONTACT_EMAIL}</a>.</p>
            <div className="space-y-3">
              {[
                ["Access", "Request a full export of all data we hold about you."],
                ["Correction", "Ask us to correct inaccurate or incomplete data."],
                ["Deletion", "Request permanent deletion of your account and all associated data."],
                ["Portability", "Receive your data in a structured, machine-readable format (JSON/CSV)."],
                ["Objection", "Opt out of marketing communications at any time via the unsubscribe link or by emailing us."],
                ["Restriction", "Request that we limit processing of your data in certain circumstances."],
              ].map(([right, desc], i) => (
                <div key={i} className="flex gap-3">
                  <span className="font-semibold text-sm w-24 flex-shrink-0 mt-0.5" style={{ color: "var(--accent-purple)" }}>{right}</span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>We will respond to all data rights requests within 30 days. If you are in the EU or UK, you also have the right to lodge a complaint with your local data protection authority.</p>
          </Section>

          <Section title="10. Cookies">
            <p>
              WorkBox uses only <strong>essential cookies</strong> — session tokens required to keep you logged in. We do not use advertising cookies, tracking cookies, or any third-party analytics cookies. You can clear cookies at any time through your browser settings, which will log you out of WorkBox.
            </p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>
              WorkBox is not directed at children under 16. We do not knowingly collect personal data from anyone under 16. If you believe a child has created an account, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-purple)" }}>{CONTACT_EMAIL}</a> and we will delete the account promptly.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We will notify you by email and with an in-app banner at least <strong>14 days before</strong> any material changes to this policy take effect. The "Last updated" date at the top of this page reflects the most recent revision. Continued use of WorkBox after the effective date constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>For any privacy-related questions, data requests, or concerns:</p>
            <div className="mt-4 rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="font-semibold">{COMPANY_NAME}</p>
              <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
                Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-purple)" }}>{CONTACT_EMAIL}</a>
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Response time: within 72 hours</p>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            © {new Date().getFullYear()} {COMPANY_NAME}. Built with privacy at the core.
          </p>
          <div className="flex justify-center gap-6 mt-3">
            <Link href="/" className="text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>Home</Link>
            <Link href="/login" className="text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>Sign in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <ul className="space-y-1.5 list-none pl-0">
        {children}
      </ul>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 text-sm leading-relaxed" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "var(--text-primary)" }}>
      {children}
    </div>
  );
}

function UsageCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div>
        <p className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
      </div>
    </div>
  );
}
