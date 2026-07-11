"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

interface Integration {
  name: string;
  description: string;
  category: string;
  color: string;
  letter: string;
  live?: boolean;
  connectHref?: string;
}

const INTEGRATIONS: Integration[] = [
  // Email
  { name: "Gmail", description: "Sync emails, threads and drafts", category: "Email", color: "#EA4335", letter: "G" },
  { name: "Outlook", description: "Connect Microsoft Outlook mail", category: "Email", color: "#0078D4", letter: "O" },

  // Calendar
  {
    name: "Google Calendar",
    description: "Schedule meetings, view events and sync them as tasks",
    category: "Calendar",
    color: "#4285F4",
    letter: "C",
    live: true,
    connectHref: "/api/auth/google/redirect",
  },
  {
    name: "Outlook Calendar",
    description: "Connect your Microsoft calendar",
    category: "Calendar",
    color: "#0078D4",
    letter: "C",
    live: true,
    connectHref: "/api/auth/microsoft/redirect",
  },

  // Video
  { name: "Zoom", description: "Start instant Zoom meetings from WorkBox", category: "Video & Calls", color: "#2D8CFF", letter: "Z", live: true, connectHref: "/api/auth/zoom/redirect" },
  { name: "Google Meet", description: "Sync meetings and call history", category: "Video & Calls", color: "#00AC47", letter: "M" },
  { name: "Microsoft Teams", description: "Connect calls, chats and channels", category: "Video & Calls", color: "#5558AF", letter: "T" },

  // Messaging
  { name: "Slack", description: "Search messages and channel history", category: "Messaging", color: "#4A154B", letter: "S" },

  // Storage & Docs
  { name: "Google Drive", description: "Index and search your Drive files", category: "Storage & Docs", color: "#FBBC04", letter: "D" },
  { name: "Dropbox", description: "Connect Dropbox files and folders", category: "Storage & Docs", color: "#0061FF", letter: "D" },
  { name: "OneDrive", description: "Sync Microsoft OneDrive documents", category: "Storage & Docs", color: "#0078D4", letter: "D" },
  { name: "Notion", description: "Index Notion pages and databases", category: "Storage & Docs", color: "#000000", letter: "N" },

  // CRM
  { name: "HubSpot", description: "Sync contacts, deals and pipelines", category: "CRM", color: "#FF7A59", letter: "H" },
  { name: "Salesforce", description: "Connect your Salesforce CRM data", category: "CRM", color: "#00A1E0", letter: "S" },

  // Project Management
  { name: "Jira", description: "Search issues, sprints and epics", category: "Project Management", color: "#0052CC", letter: "J" },
  { name: "Linear", description: "Access issues and project updates", category: "Project Management", color: "#5E6AD2", letter: "L" },
  { name: "Asana", description: "Sync tasks, projects and timelines", category: "Project Management", color: "#F06A6A", letter: "A" },

  // HR
  { name: "BambooHR", description: "Connect HR records and org charts", category: "HR", color: "#73C41D", letter: "B" },
];

const CATEGORIES = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

export default function IntegrationsClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [notified, setNotified] = useState<string | null>(null);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [outlookConnected, setOutlookConnected] = useState<boolean | null>(null);
  const [outlookEmail, setOutlookEmail] = useState<string | null>(null);
  const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);
  const [zoomEmail, setZoomEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then(r => r.json())
      .then(d => { setGcalConnected(d.connected); setGcalEmail(d.email); })
      .catch(() => setGcalConnected(false));
    fetch("/api/outlook-calendar/status")
      .then(r => r.json())
      .then(d => { setOutlookConnected(d.connected); setOutlookEmail(d.email); })
      .catch(() => setOutlookConnected(false));
    fetch("/api/zoom/status")
      .then(r => r.json())
      .then(d => { setZoomConnected(d.connected); setZoomEmail(d.email); })
      .catch(() => setZoomConnected(false));
  }, []);

  async function disconnectZoom() {
    if (!confirm("Disconnect Zoom?")) return;
    await fetch("/api/zoom/status", { method: "DELETE" });
    setZoomConnected(false); setZoomEmail(null);
  }

  async function disconnectGcal() {
    if (!confirm("Disconnect Google Calendar?")) return;
    await fetch("/api/google-calendar/status", { method: "DELETE" });
    setGcalConnected(false);
    setGcalEmail(null);
  }

  async function disconnectOutlook() {
    if (!confirm("Disconnect Outlook Calendar?")) return;
    await fetch("/api/outlook-calendar/status", { method: "DELETE" });
    setOutlookConnected(false);
    setOutlookEmail(null);
  }

  const filtered = INTEGRATIONS.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const visibleCategories = CATEGORIES.filter((cat) =>
    filtered.some((i) => i.category === cat)
  );

  function handleConnect(integration: Integration) {
    if (integration.live && integration.connectHref) {
      window.location.href = integration.connectHref;
      return;
    }
    setNotified(integration.name);
    setTimeout(() => setNotified(null), 2500);
  }

  function renderAction(integration: Integration) {
    if (integration.name === "Google Calendar") {
      if (gcalConnected === null) return null;
      if (gcalConnected) {
        return (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
              style={{ background: "#22c55e22", color: "#22c55e" }}>
              <Check size={11} /> Connected
            </span>
            <button onClick={() => router.push("/meetings")}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#4285F4] hover:text-[#4285F4] transition-colors">
              View Meetings
            </button>
            <button onClick={disconnectGcal}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Disconnect
            </button>
          </div>
        );
      }
      return (
        <button onClick={() => handleConnect(integration)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#4285F4] hover:text-[#4285F4] transition-colors">
          Connect
        </button>
      );
    }

    if (integration.name === "Outlook Calendar") {
      if (outlookConnected === null) return null;
      if (outlookConnected) {
        return (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
              style={{ background: "#22c55e22", color: "#22c55e" }}>
              <Check size={11} /> Connected
            </span>
            <button onClick={() => router.push("/meetings")}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#0078D4] hover:text-[#0078D4] transition-colors">
              View Meetings
            </button>
            <button onClick={disconnectOutlook}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Disconnect
            </button>
          </div>
        );
      }
      return (
        <button onClick={() => handleConnect(integration)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#0078D4] hover:text-[#0078D4] transition-colors">
          Connect
        </button>
      );
    }

    if (integration.name === "Zoom") {
      if (zoomConnected === null) return null;
      if (zoomConnected) {
        return (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: "#22c55e22", color: "#22c55e" }}>
              <Check size={11} /> Connected{zoomEmail ? ` · ${zoomEmail}` : ""}
            </span>
            <button onClick={() => router.push("/meetings")}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#2D8CFF] hover:text-[#2D8CFF] transition-colors">
              Start a meeting
            </button>
            <button onClick={disconnectZoom} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Disconnect</button>
          </div>
        );
      }
      return (
        <button onClick={() => handleConnect(integration)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#2D8CFF] hover:text-[#2D8CFF] transition-colors">
          Connect
        </button>
      );
    }

    return (
      <button
        onClick={() => handleConnect(integration)}
        className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#1a3c5e] hover:text-[#1a3c5e] transition-colors"
      >
        Connect
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Connect your tools</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Link your business apps so WorkBox can answer questions from all your data in one place.
          </p>
        </div>

        <div className="mb-8">
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white"
          />
        </div>

        {notified && (
          <div className="fixed bottom-6 right-6 bg-[#1a3c5e] text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">
            {notified} integration coming soon — we&apos;ll notify you when it&apos;s ready.
          </div>
        )}

        {visibleCategories.map((category) => (
          <div key={category} className="mb-10">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              {category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered
                .filter((i) => i.category === category)
                .map((integration) => (
                  <div
                    key={integration.name}
                    className="bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: integration.color }}
                    >
                      {integration.letter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{integration.name}</p>
                        {integration.live && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: "#4285F422", color: "#4285F4" }}>
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{integration.description}</p>
                      {gcalEmail && integration.name === "Google Calendar" && (
                        <p className="text-xs mt-1" style={{ color: "#4285F4" }}>{gcalEmail}</p>
                      )}
                      {outlookEmail && integration.name === "Outlook Calendar" && (
                        <p className="text-xs mt-1" style={{ color: "#0078D4" }}>{outlookEmail}</p>
                      )}
                      {renderAction(integration)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-12 text-center">No integrations match &quot;{search}&quot;</p>
        )}
      </div>
    </div>
  );
}
