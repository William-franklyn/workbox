"use client";
import { useEffect, useState } from "react";
import { Shield, Building2, Users, DollarSign, Loader2, TrendingUp } from "lucide-react";

interface Overview {
  totals: { orgs: number; users: number; paying: number; mrr: number };
  planCounts: Record<string, number>;
  orgs: { id: string; name: string; plan: string; plan_status: string; members: number; owner_email: string | null; created_at: string }[];
  recentUsers: { email: string; name: string; role: string; created_at: string }[];
}

const PLAN_COLOR: Record<string, string> = {
  free: "var(--text-muted)", starter: "#60a5fa", pro: "var(--accent-purple)", business: "#22c55e", enterprise: "#f59e0b",
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: "var(--text-secondary)" }}>{icon}<span className="text-xs uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

export default function OperatorPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    fetch("/api/operator/overview").then(async r => {
      if (r.status === 403) { setDenied(true); return; }
      if (r.ok) setData(await r.json());
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>;

  if (denied) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Shield size={36} style={{ color: "var(--text-muted)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Operator access only</p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Your account isn&apos;t on the operator allowlist.</p>
    </div>
  );

  if (!data) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <Shield size={20} style={{ color: "var(--accent-purple)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Operator Console</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Platform-wide view across all organizations.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Building2 size={13} />} label="Organizations" value={String(data.totals.orgs)} />
        <Stat icon={<Users size={13} />} label="Users" value={String(data.totals.users)} />
        <Stat icon={<TrendingUp size={13} />} label="Paying orgs" value={String(data.totals.paying)} />
        <Stat icon={<DollarSign size={13} />} label="Est. MRR" value={`$${data.totals.mrr.toLocaleString()}`} />
      </div>

      {/* Plan breakdown */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(data.planCounts).map(([plan, n]) => (
          <span key={plan} className="text-xs px-3 py-1 rounded-full capitalize font-medium"
            style={{ background: "var(--bg-surface)", color: PLAN_COLOR[plan] ?? "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {n} {plan}
          </span>
        ))}
      </div>

      {/* Org directory */}
      <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Organizations</h2>
      <div className="rounded-xl border overflow-hidden mb-8" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide">Organization</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide">Members</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide">Owner</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.orgs.map(o => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>{o.name}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ color: PLAN_COLOR[o.plan] ?? "var(--text-secondary)", background: "var(--bg-surface)" }}>{o.plan}</span>
                    {o.plan_status !== "active" && <span className="text-xs ml-1" style={{ color: "var(--warning)" }}>({o.plan_status})</span>}
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{o.members}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{o.owner_email ?? "—"}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent signups */}
      <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Recent signups</h2>
      <div className="space-y-1.5">
        {data.recentUsers.map((u, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{u.name || u.email}</span>
              <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{u.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{u.role}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
