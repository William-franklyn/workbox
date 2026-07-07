"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { Loader2, CheckCircle2, Layout, Code2, Megaphone, Users, Briefcase, ShoppingCart, BookOpen, Rocket, Bug, Target, UserPlus, CalendarDays } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  tag: string;
  structure: {
    space: { name: string; icon: string; color: string };
    lists: { name: string; color: string; tasks: { title: string; priority: string; status: string }[] }[];
  };
}

const TEMPLATES: Template[] = [
  {
    id: "software-sprint",
    name: "Software Sprint",
    description: "Agile sprint board with backlog, in-progress, review, and done columns. Perfect for dev teams.",
    icon: <Code2 size={20} />, color: "#3b82f6", tag: "Engineering",
    structure: {
      space: { name: "Engineering", icon: "⚙️", color: "#3b82f6" },
      lists: [
        { name: "Backlog", color: "#64748b", tasks: [{ title: "Write API documentation", priority: "normal", status: "todo" }, { title: "Set up CI/CD pipeline", priority: "high", status: "todo" }, { title: "Code review guidelines", priority: "low", status: "todo" }] },
        { name: "Sprint", color: "#7c3aed", tasks: [{ title: "User authentication", priority: "urgent", status: "in_progress" }, { title: "Dashboard UI", priority: "high", status: "todo" }] },
        { name: "In Review", color: "#f59e0b", tasks: [{ title: "Database migrations", priority: "high", status: "in_review" }] },
        { name: "Done", color: "#22c55e", tasks: [{ title: "Project setup", priority: "normal", status: "done" }] },
      ],
    },
  },
  {
    id: "marketing-campaign",
    name: "Marketing Campaign",
    description: "End-to-end campaign management from ideation to launch to analysis.",
    icon: <Megaphone size={20} />, color: "#ec4899", tag: "Marketing",
    structure: {
      space: { name: "Marketing", icon: "📣", color: "#ec4899" },
      lists: [
        { name: "Ideas", color: "#a855f7", tasks: [{ title: "Q3 campaign theme", priority: "high", status: "todo" }, { title: "Competitor analysis", priority: "normal", status: "todo" }] },
        { name: "In Production", color: "#3b82f6", tasks: [{ title: "Social media copy", priority: "high", status: "in_progress" }, { title: "Email sequence", priority: "urgent", status: "in_progress" }] },
        { name: "Review", color: "#f59e0b", tasks: [{ title: "Landing page design", priority: "high", status: "in_review" }] },
        { name: "Live", color: "#22c55e", tasks: [{ title: "Google Ads setup", priority: "normal", status: "done" }] },
      ],
    },
  },
  {
    id: "product-roadmap",
    name: "Product Roadmap",
    description: "Quarterly product planning with features, bugs, and improvements tracked by priority.",
    icon: <Rocket size={20} />, color: "#7c3aed", tag: "Product",
    structure: {
      space: { name: "Product", icon: "🗺️", color: "#7c3aed" },
      lists: [
        { name: "Q1 Features", color: "#7c3aed", tasks: [{ title: "Onboarding flow redesign", priority: "urgent", status: "in_progress" }, { title: "Mobile app", priority: "high", status: "todo" }] },
        { name: "Q2 Features", color: "#a855f7", tasks: [{ title: "Integrations marketplace", priority: "high", status: "todo" }, { title: "Dark mode", priority: "normal", status: "todo" }] },
        { name: "Bug Fixes", color: "#ef4444", tasks: [{ title: "Safari layout bug", priority: "urgent", status: "todo" }, { title: "Email notification delay", priority: "high", status: "in_progress" }] },
        { name: "Shipped", color: "#22c55e", tasks: [{ title: "Search functionality", priority: "high", status: "done" }] },
      ],
    },
  },
  {
    id: "hr-onboarding",
    name: "HR & Onboarding",
    description: "Structured new hire onboarding with checklists for equipment, access, training, and goals.",
    icon: <Users size={20} />, color: "#22c55e", tag: "HR",
    structure: {
      space: { name: "People & HR", icon: "👥", color: "#22c55e" },
      lists: [
        { name: "Pre-start", color: "#64748b", tasks: [{ title: "Send offer letter", priority: "urgent", status: "todo" }, { title: "Order equipment", priority: "high", status: "todo" }, { title: "Create accounts", priority: "high", status: "todo" }] },
        { name: "Week 1", color: "#3b82f6", tasks: [{ title: "Office tour", priority: "normal", status: "todo" }, { title: "Meet team leads", priority: "high", status: "todo" }, { title: "Tool access walkthrough", priority: "high", status: "todo" }] },
        { name: "Month 1", color: "#7c3aed", tasks: [{ title: "First project kickoff", priority: "normal", status: "todo" }, { title: "30-day check-in", priority: "high", status: "todo" }] },
        { name: "Completed", color: "#22c55e", tasks: [] },
      ],
    },
  },
  {
    id: "sales-crm",
    name: "Sales Pipeline",
    description: "Track leads from prospect to closed deal with probability, value, and next action fields.",
    icon: <ShoppingCart size={20} />, color: "#f59e0b", tag: "Sales",
    structure: {
      space: { name: "Sales", icon: "💰", color: "#f59e0b" },
      lists: [
        { name: "Prospects", color: "#64748b", tasks: [{ title: "Acme Corp - initial outreach", priority: "high", status: "todo" }, { title: "TechStart - discovery call", priority: "normal", status: "todo" }] },
        { name: "Qualified", color: "#3b82f6", tasks: [{ title: "Globex - demo scheduled", priority: "urgent", status: "in_progress" }] },
        { name: "Proposal", color: "#f59e0b", tasks: [{ title: "MegaCorp - send proposal", priority: "urgent", status: "in_progress" }] },
        { name: "Negotiation", color: "#a855f7", tasks: [{ title: "StartupXYZ - contract review", priority: "high", status: "in_review" }] },
        { name: "Closed Won", color: "#22c55e", tasks: [{ title: "Acme Corp - signed!", priority: "normal", status: "done" }] },
      ],
    },
  },
  {
    id: "content-calendar",
    name: "Content Calendar",
    description: "Plan, write, review, and publish content across all your channels in one view.",
    icon: <BookOpen size={20} />, color: "#06b6d4", tag: "Content",
    structure: {
      space: { name: "Content", icon: "📝", color: "#06b6d4" },
      lists: [
        { name: "Ideas", color: "#a855f7", tasks: [{ title: "10 productivity tips blog post", priority: "normal", status: "todo" }, { title: "Product demo video script", priority: "high", status: "todo" }] },
        { name: "Writing", color: "#3b82f6", tasks: [{ title: "June newsletter", priority: "urgent", status: "in_progress" }, { title: "Twitter thread: AI tools", priority: "high", status: "in_progress" }] },
        { name: "Review", color: "#f59e0b", tasks: [{ title: "Case study: Acme Corp", priority: "high", status: "in_review" }] },
        { name: "Published", color: "#22c55e", tasks: [{ title: "May newsletter", priority: "normal", status: "done" }] },
      ],
    },
  },
  {
    id: "general-project",
    name: "General Project",
    description: "Simple, flexible task management for any project — planning, doing, reviewing, done.",
    icon: <Layout size={20} />, color: "#64748b", tag: "General",
    structure: {
      space: { name: "My Project", icon: "🚀", color: "#7c3aed" },
      lists: [
        { name: "To Do", color: "#64748b", tasks: [{ title: "Define project scope", priority: "high", status: "todo" }, { title: "Identify stakeholders", priority: "normal", status: "todo" }] },
        { name: "In Progress", color: "#7c3aed", tasks: [{ title: "Kickoff meeting", priority: "urgent", status: "in_progress" }] },
        { name: "Review", color: "#f59e0b", tasks: [] },
        { name: "Done", color: "#22c55e", tasks: [] },
      ],
    },
  },
  {
    id: "personal-workspace",
    name: "Personal Workspace",
    description: "Stay on top of personal goals, daily tasks, and long-term projects all in one place.",
    icon: <Briefcase size={20} />, color: "#8b5cf6", tag: "Personal",
    structure: {
      space: { name: "Personal", icon: "⭐", color: "#8b5cf6" },
      lists: [
        { name: "Today", color: "#ef4444", tasks: [{ title: "Morning workout", priority: "high", status: "todo" }, { title: "Read 30 minutes", priority: "normal", status: "todo" }] },
        { name: "This Week", color: "#f59e0b", tasks: [{ title: "Grocery shopping", priority: "normal", status: "todo" }, { title: "Call mom", priority: "high", status: "todo" }] },
        { name: "Goals", color: "#7c3aed", tasks: [{ title: "Learn Spanish", priority: "normal", status: "in_progress" }, { title: "Save $10k", priority: "high", status: "in_progress" }] },
        { name: "Done", color: "#22c55e", tasks: [] },
      ],
    },
  },
  {
    id: "bug-tracker",
    name: "Bug Tracker",
    description: "Triage, reproduce, fix, and verify bugs with clear priority levels and status tracking.",
    icon: <Bug size={20} />, color: "#ef4444", tag: "Engineering",
    structure: {
      space: { name: "Bug Tracker", icon: "🐛", color: "#ef4444" },
      lists: [
        { name: "Reported", color: "#64748b", tasks: [{ title: "Login page 500 error on mobile", priority: "urgent", status: "todo" }, { title: "Dashboard chart not loading", priority: "high", status: "todo" }, { title: "Email notifications delayed", priority: "normal", status: "todo" }] },
        { name: "Triaged", color: "#f59e0b", tasks: [{ title: "Search returns wrong results", priority: "high", status: "todo" }, { title: "File upload limit not enforced", priority: "normal", status: "todo" }] },
        { name: "In Fix", color: "#7c3aed", tasks: [{ title: "Memory leak in WebSocket handler", priority: "urgent", status: "in_progress" }] },
        { name: "Verifying", color: "#3b82f6", tasks: [{ title: "Date picker timezone issue", priority: "high", status: "in_review" }] },
        { name: "Resolved", color: "#22c55e", tasks: [{ title: "CSV export encoding bug", priority: "normal", status: "done" }] },
      ],
    },
  },
  {
    id: "okr-planning",
    name: "OKR Planning",
    description: "Set and track Objectives and Key Results at company, team, and individual levels.",
    icon: <Target size={20} />, color: "#7c3aed", tag: "Strategy",
    structure: {
      space: { name: "OKRs", icon: "🎯", color: "#7c3aed" },
      lists: [
        { name: "Company OKRs", color: "#7c3aed", tasks: [{ title: "Reach $1M ARR by Q4", priority: "urgent", status: "in_progress" }, { title: "Expand to 3 new markets", priority: "high", status: "todo" }, { title: "Achieve NPS > 60", priority: "high", status: "in_progress" }] },
        { name: "Engineering", color: "#3b82f6", tasks: [{ title: "99.9% uptime SLA", priority: "urgent", status: "in_progress" }, { title: "Deploy 2 major features per quarter", priority: "high", status: "todo" }] },
        { name: "Marketing", color: "#ec4899", tasks: [{ title: "Generate 500 qualified leads/month", priority: "high", status: "in_progress" }, { title: "Grow organic traffic 40%", priority: "normal", status: "todo" }] },
        { name: "Achieved", color: "#22c55e", tasks: [{ title: "Launch v2.0 product", priority: "urgent", status: "done" }] },
      ],
    },
  },
  {
    id: "hiring-pipeline",
    name: "Hiring Pipeline",
    description: "Manage job openings, candidate screening, interviews, and onboarding all in one place.",
    icon: <UserPlus size={20} />, color: "#06b6d4", tag: "HR",
    structure: {
      space: { name: "Recruiting", icon: "🧑‍💼", color: "#06b6d4" },
      lists: [
        { name: "Open Roles", color: "#64748b", tasks: [{ title: "Senior Frontend Engineer", priority: "urgent", status: "todo" }, { title: "Product Designer", priority: "high", status: "todo" }, { title: "Growth Marketer", priority: "normal", status: "todo" }] },
        { name: "Screening", color: "#f59e0b", tasks: [{ title: "Alex Chen — Frontend Engineer", priority: "high", status: "in_progress" }, { title: "Maria Santos — Designer", priority: "high", status: "in_progress" }] },
        { name: "Interviews", color: "#7c3aed", tasks: [{ title: "Jordan Lee — Final round", priority: "urgent", status: "in_review" }] },
        { name: "Offer Extended", color: "#3b82f6", tasks: [{ title: "Sam Rivera — Offer sent", priority: "high", status: "in_review" }] },
        { name: "Hired", color: "#22c55e", tasks: [{ title: "Taylor Kim — Backend Eng", priority: "normal", status: "done" }] },
      ],
    },
  },
  {
    id: "weekly-review",
    name: "Weekly Review",
    description: "A structured weekly planning system to review wins, prioritize tasks, and set intentions.",
    icon: <CalendarDays size={20} />, color: "#f59e0b", tag: "Personal",
    structure: {
      space: { name: "Weekly Review", icon: "📅", color: "#f59e0b" },
      lists: [
        { name: "Last Week — Wins", color: "#22c55e", tasks: [{ title: "Shipped landing page redesign", priority: "normal", status: "done" }, { title: "Closed 2 deals", priority: "normal", status: "done" }] },
        { name: "This Week — Priorities", color: "#ef4444", tasks: [{ title: "Prepare quarterly board deck", priority: "urgent", status: "todo" }, { title: "1:1s with all direct reports", priority: "high", status: "todo" }, { title: "Finalize product roadmap", priority: "high", status: "todo" }] },
        { name: "Follow-ups", color: "#f59e0b", tasks: [{ title: "Reply to investor email", priority: "high", status: "todo" }, { title: "Schedule design review", priority: "normal", status: "todo" }] },
        { name: "Someday / Maybe", color: "#64748b", tasks: [{ title: "Explore new CRM options", priority: "low", status: "todo" }, { title: "Revamp onboarding flow", priority: "low", status: "todo" }] },
      ],
    },
  },
];

const TAG_COLORS: Record<string, string> = {
  Engineering: "#3b82f6", Marketing: "#ec4899", Product: "#7c3aed",
  HR: "#22c55e", Sales: "#f59e0b", Content: "#06b6d4", General: "#64748b",
  Personal: "#8b5cf6", Strategy: "#a855f7",
};

export default function TemplatesPage() {
  const router = useRouter();
  const { loadSpaces } = useWorkspaceStore();
  const [applying, setApplying] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const tags = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.tag)))];

  async function applyTemplate(tpl: Template) {
    setApplying(tpl.id);
    try {
      // Create the space
      const spaceRes = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "space", name: tpl.structure.space.name, icon: tpl.structure.space.icon, color: tpl.structure.space.color }),
      });
      const spaceData = await spaceRes.json();
      const spaceId = spaceData.space?.id ?? spaceData.id;
      if (!spaceId) throw new Error("Space creation failed");

      // Create lists + tasks
      for (const list of tpl.structure.lists) {
        const listRes = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "list", name: list.name, space_id: spaceId, color: list.color }),
        });
        const listData = await listRes.json();
        const listId = listData.list?.id ?? listData.id;
        if (!listId) continue;

        // Create tasks
        for (let i = 0; i < list.tasks.length; i++) {
          const task = list.tasks[i];
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: task.title, status: task.status, priority: task.priority, list_id: listId, position: i }),
          });
        }
      }

      setDone(tpl.id);
      await loadSpaces();
      setTimeout(() => {
        setDone(null);
        router.push("/home");
      }, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setApplying(null);
    }
  }

  const filtered = filter === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.tag === filter);

  return (
    <div className="overflow-y-auto h-full p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Templates</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Start with a ready-made workspace. One click creates the full structure — spaces, lists, and sample tasks.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tags.map((tag) => (
            <button key={tag} onClick={() => setFilter(tag)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: filter === tag ? "var(--accent-purple)" : "var(--bg-secondary)",
                color: filter === tag ? "white" : "var(--text-secondary)",
                border: filter === tag ? "none" : "1px solid var(--border)",
              }}>
              {tag}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tpl) => {
            const isApplying = applying === tpl.id;
            const isDone = done === tpl.id;

            return (
              <div key={tpl.id} className="rounded-2xl border flex flex-col overflow-hidden transition-all hover:border-purple-500/30"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                {/* Color bar */}
                <div className="h-1.5 w-full" style={{ background: tpl.color }} />

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${tpl.color}22`, color: tpl.color }}>
                      {tpl.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tpl.name}</h3>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${TAG_COLORS[tpl.tag] ?? "#64748b"}22`, color: TAG_COLORS[tpl.tag] ?? "#64748b" }}>
                        {tpl.tag}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "var(--text-secondary)" }}>{tpl.description}</p>

                  {/* Lists preview */}
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    {tpl.structure.lists.map((l) => (
                      <span key={l.name} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${l.color}22`, color: l.color }}>
                        {l.name}
                      </span>
                    ))}
                  </div>

                  <button onClick={() => applyTemplate(tpl)} disabled={!!applying || !!done}
                    className="w-full py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: isDone ? "var(--success)" : "var(--accent-purple)", color: "white" }}>
                    {isApplying ? (
                      <><Loader2 size={14} className="animate-spin" /> Creating workspace…</>
                    ) : isDone ? (
                      <><CheckCircle2 size={14} /> Created! Redirecting…</>
                    ) : (
                      "Use this template"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
