"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, Users, Calendar, CheckCircle, Clock, X,
  Loader2, Trash2, Edit3, Mail, Phone, MapPin, Briefcase, UserCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string; full_name: string; email?: string; phone?: string;
  job_title?: string; department?: string; employment_type?: string;
  status?: string; start_date?: string; location?: string;
  manager_id?: string; created_at: string;
  manager?: { id: string; full_name: string; job_title?: string } | null;
}

interface LeaveRequest {
  id: string; employee_id: string; type?: string; start_date: string;
  end_date: string; days?: number; status?: string; reason?: string; created_at: string;
  employee?: { id: string; full_name: string; department?: string; job_title?: string } | null;
}

const DEPTS = ["All", "Engineering", "Product", "Design", "Marketing", "Sales", "Operations", "Finance", "HR", "Legal", "Executive"];
const EMP_TYPES = ["full_time", "part_time", "contractor", "intern"];
const LEAVE_TYPES = ["annual", "sick", "personal", "maternity", "paternity", "unpaid"];
const EMP_STATUS = ["active", "on_leave", "terminated"];

const STATUS_COLOR: Record<string, string> = {
  active: "rgba(255,255,255,0.1)", on_leave: "rgba(255,255,255,0.06)", terminated: "rgba(255,255,255,0.04)",
};
const LEAVE_STATUS_COLOR: Record<string, string> = {
  pending: "rgba(255,255,255,0.08)", approved: "rgba(255,255,255,0.12)", rejected: "rgba(255,255,255,0.04)",
};

const inputCls = "w-full text-sm px-3 py-2 rounded-lg border outline-none";
const inputStyle = { background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Employee Form ────────────────────────────────────────────────────────────

function EmployeeForm({ initial, employees, onSave, onClose }: {
  initial?: Employee; employees: Employee[];
  onSave: (e: Employee) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    full_name: initial?.full_name ?? "", email: initial?.email ?? "",
    phone: initial?.phone ?? "", job_title: initial?.job_title ?? "",
    department: initial?.department ?? "", employment_type: initial?.employment_type ?? "full_time",
    status: initial?.status ?? "active", start_date: initial?.start_date ?? "",
    location: initial?.location ?? "", manager_id: initial?.manager_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.full_name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/hr", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial
        ? { id: initial.id, ...f, manager_id: f.manager_id || null, start_date: f.start_date || null }
        : { ...f, manager_id: f.manager_id || null, start_date: f.start_date || null }
      ),
    });
    const d = await res.json();
    setSaving(false);
    onSave(d);
  }

  return (
    <div className="space-y-3">
      <Field label="Full name *"><input value={f.full_name} onChange={e => upd("full_name", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input value={f.email} onChange={e => upd("email", e.target.value)} type="email" className={inputCls} style={inputStyle} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={e => upd("phone", e.target.value)} type="tel" className={inputCls} style={inputStyle} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job title"><input value={f.job_title} onChange={e => upd("job_title", e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="Department"><input value={f.department} onChange={e => upd("department", e.target.value)} list="depts" className={inputCls} style={inputStyle} />
          <datalist id="depts">{DEPTS.slice(1).map(d => <option key={d} value={d} />)}</datalist>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employment type">
          <select value={f.employment_type} onChange={e => upd("employment_type", e.target.value)} className={inputCls} style={inputStyle}>
            {EMP_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={e => upd("status", e.target.value)} className={inputCls} style={inputStyle}>
            {EMP_STATUS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date"><input value={f.start_date} onChange={e => upd("start_date", e.target.value)} type="date" className={inputCls} style={inputStyle} /></Field>
        <Field label="Location"><input value={f.location} onChange={e => upd("location", e.target.value)} placeholder="City, Country" className={inputCls} style={inputStyle} /></Field>
      </div>
      <Field label="Reports to (manager)">
        <select value={f.manager_id} onChange={e => upd("manager_id", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">No manager</option>
          {employees.filter(e => e.id !== initial?.id).map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.full_name.trim()}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#fff" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Leave Form ───────────────────────────────────────────────────────────────

function LeaveForm({ employees, onSave, onClose }: {
  employees: Employee[]; onSave: (l: LeaveRequest) => void; onClose: () => void;
}) {
  const [f, setF] = useState({ employee_id: "", type: "annual", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const days = f.start_date && f.end_date
    ? Math.max(1, Math.ceil((new Date(f.end_date).getTime() - new Date(f.start_date).getTime()) / 86400000) + 1)
    : 0;

  async function save() {
    if (!f.employee_id || !f.start_date || !f.end_date) return;
    setSaving(true);
    const res = await fetch("/api/hr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, type: "leave", days }),
    });
    const d = await res.json();
    setSaving(false);
    onSave(d);
  }

  return (
    <div className="space-y-3">
      <Field label="Employee *">
        <select value={f.employee_id} onChange={e => upd("employee_id", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Select employee...</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </Field>
      <Field label="Leave type">
        <select value={f.type} onChange={e => upd("type", e.target.value)} className={inputCls} style={inputStyle}>
          {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date"><input value={f.start_date} onChange={e => upd("start_date", e.target.value)} type="date" className={inputCls} style={inputStyle} /></Field>
        <Field label="End date"><input value={f.end_date} onChange={e => upd("end_date", e.target.value)} type="date" className={inputCls} style={inputStyle} /></Field>
      </div>
      {days > 0 && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{days} working day{days !== 1 ? "s" : ""}</p>}
      <Field label="Reason"><textarea value={f.reason} onChange={e => upd("reason", e.target.value)} rows={3} placeholder="Optional reason..." className={`${inputCls} resize-none`} style={inputStyle} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.employee_id || !f.start_date || !f.end_date}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#fff" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Submit Request
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HRPage() {
  const [tab, setTab] = useState<"directory" | "leave">("directory");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [modal, setModal] = useState<"employee" | "leave" | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/hr?type=employees").then(r => r.json()),
      fetch("/api/hr?type=leave").then(r => r.json()),
    ]).then(([e, l]) => {
      setEmployees(Array.isArray(e) ? e : []);
      setLeaves(Array.isArray(l) ? l : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteEmployee(id: string) {
    if (!confirm("Remove this employee?")) return;
    setEmployees(p => p.filter(e => e.id !== id));
    await fetch(`/api/hr?id=${id}&type=employee`, { method: "DELETE" });
  }

  async function updateLeaveStatus(id: string, status: string) {
    setLeaves(p => p.map(l => l.id === id ? { ...l, status } : l));
    await fetch("/api/hr", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "leave", status }),
    });
  }

  function handleSavedEmployee(e: Employee) {
    setEmployees(p => { const i = p.findIndex(x => x.id === e.id); if (i >= 0) { const n = [...p]; n[i] = e; return n; } return [e, ...p]; });
    setModal(null); setEditing(null);
  }

  function handleSavedLeave(l: LeaveRequest) {
    setLeaves(p => [l, ...p]);
    setModal(null);
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${e.full_name} ${e.job_title} ${e.department} ${e.email}`.toLowerCase().includes(q);
    const matchDept = deptFilter === "All" || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const depts = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
  const activeCount = employees.filter(e => e.status === "active").length;
  const pendingLeaves = leaves.filter(l => l.status === "pending").length;

  return (
    <>
      {modal === "employee" && (
        <Modal title={editing ? "Edit Employee" : "Add Employee"} onClose={() => { setModal(null); setEditing(null); }}>
          <EmployeeForm initial={editing ?? undefined} employees={employees} onSave={handleSavedEmployee} onClose={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}
      {modal === "leave" && (
        <Modal title="New Leave Request" onClose={() => setModal(null)}>
          <LeaveForm employees={employees} onSave={handleSavedLeave} onClose={() => setModal(null)} />
        </Modal>
      )}

      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>People & HR</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {activeCount} active employees · {pendingLeaves} leave requests pending
              </p>
            </div>
            <button onClick={() => { setEditing(null); setModal(tab === "leave" ? "leave" : "employee"); }}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: "var(--accent-purple)", color: "#fff" }}>
              <Plus size={14} /> {tab === "leave" ? "Request Leave" : "Add Employee"}
            </button>
          </div>

          <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
            {[
              { id: "directory" as const, label: "Directory", icon: <Users size={14} /> },
              { id: "leave" as const, label: "Leave Requests", icon: <Calendar size={14} />, badge: pendingLeaves },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                  borderBottom: tab === t.id ? "2px solid var(--accent-purple)" : "2px solid transparent",
                }}>
                {t.icon} {t.label}
                {t.badge ? <span className="text-xs px-1.5 py-0.5 rounded-full ml-1" style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "directory" && (
            <>
              {/* Filters */}
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search employees..."
                    className="text-sm pl-9 pr-3 py-2 rounded-lg border outline-none w-56"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["All", ...depts].map(d => (
                    <button key={d} onClick={() => setDeptFilter(d ?? "All")}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: deptFilter === d ? "rgba(255,255,255,0.12)" : "var(--bg-surface)",
                        color: deptFilter === d ? "var(--text-primary)" : "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <Users size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No employees found</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Add your team members to the directory.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map(e => (
                    <div key={e.id} className="rounded-xl border p-4 hover:border-white/20 transition-colors group"
                      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
                            {e.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{e.full_name}</p>
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{e.job_title ?? "—"}</p>
                            {e.department && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{e.department}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditing(e); setModal("employee"); }} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={12} /></button>
                          <button onClick={() => deleteEmployee(e.id)} className="p-1.5 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {e.email && <p className="flex items-center gap-2 truncate"><Mail size={11} />{e.email}</p>}
                        {e.phone && <p className="flex items-center gap-2"><Phone size={11} />{e.phone}</p>}
                        {e.location && <p className="flex items-center gap-2"><MapPin size={11} />{e.location}</p>}
                        {e.manager && <p className="flex items-center gap-2"><UserCheck size={11} />Reports to: {e.manager.full_name}</p>}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                          style={{ background: STATUS_COLOR[e.status ?? "active"] ?? "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                          {(e.status ?? "active").replace("_", " ")}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                          {(e.employment_type ?? "full_time").replace("_", " ")}
                        </span>
                        {e.start_date && (
                          <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                            Since {new Date(e.start_date).getFullYear()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "leave" && (
            <div className="space-y-3 max-w-3xl">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
              ) : leaves.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
                  <Calendar size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No leave requests</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Leave requests will appear here.</p>
                </div>
              ) : leaves.map(l => (
                <div key={l.id} className="rounded-xl border p-4 flex items-start gap-4"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{l.employee?.full_name ?? "Unknown"}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>{l.type}</span>
                    </div>
                    {l.employee?.department && <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{l.employee.department}</p>}
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1"><Calendar size={11} />{l.start_date} → {l.end_date}</span>
                      {l.days && <span>{l.days} day{l.days !== 1 ? "s" : ""}</span>}
                    </div>
                    {l.reason && <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>{l.reason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: LEAVE_STATUS_COLOR[l.status ?? "pending"], color: "var(--text-secondary)" }}>
                      {l.status ?? "pending"}
                    </span>
                    {l.status === "pending" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => updateLeaveStatus(l.id, "approved")}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
                          <CheckCircle size={11} /> Approve
                        </button>
                        <button onClick={() => updateLeaveStatus(l.id, "rejected")}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                          <X size={11} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
