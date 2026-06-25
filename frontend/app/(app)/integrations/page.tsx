"use client";
import { useState } from "react";

interface Integration {
  name: string;
  description: string;
  category: string;
  color: string;
  letter: string;
  status: "available" | "coming_soon";
}

const INTEGRATIONS: Integration[] = [
  // Email
  { name: "Gmail", description: "Sync emails, threads and drafts", category: "Email", color: "#EA4335", letter: "G", status: "coming_soon" },
  { name: "Outlook", description: "Connect Microsoft Outlook mail", category: "Email", color: "#0078D4", letter: "O", status: "coming_soon" },

  // Calendar
  { name: "Google Calendar", description: "Sync events, meetings and reminders", category: "Calendar", color: "#4285F4", letter: "C", status: "coming_soon" },
  { name: "Outlook Calendar", description: "Connect your Microsoft calendar", category: "Calendar", color: "#0078D4", letter: "C", status: "coming_soon" },

  // Video
  { name: "Zoom", description: "Access meeting recordings and transcripts", category: "Video & Calls", color: "#2D8CFF", letter: "Z", status: "coming_soon" },
  { name: "Google Meet", description: "Sync meetings and call history", category: "Video & Calls", color: "#00AC47", letter: "M", status: "coming_soon" },
  { name: "Microsoft Teams", description: "Connect calls, chats and channels", category: "Video & Calls", color: "#5558AF", letter: "T", status: "coming_soon" },

  // Messaging
  { name: "Slack", description: "Search messages and channel history", category: "Messaging", color: "#4A154B", letter: "S", status: "coming_soon" },

  // Storage & Docs
  { name: "Google Drive", description: "Index and search your Drive files", category: "Storage & Docs", color: "#FBBC04", letter: "D", status: "coming_soon" },
  { name: "Dropbox", description: "Connect Dropbox files and folders", category: "Storage & Docs", color: "#0061FF", letter: "D", status: "coming_soon" },
  { name: "OneDrive", description: "Sync Microsoft OneDrive documents", category: "Storage & Docs", color: "#0078D4", letter: "D", status: "coming_soon" },
  { name: "Notion", description: "Index Notion pages and databases", category: "Storage & Docs", color: "#000000", letter: "N", status: "coming_soon" },

  // CRM
  { name: "HubSpot", description: "Sync contacts, deals and pipelines", category: "CRM", color: "#FF7A59", letter: "H", status: "coming_soon" },
  { name: "Salesforce", description: "Connect your Salesforce CRM data", category: "CRM", color: "#00A1E0", letter: "S", status: "coming_soon" },

  // Project Management
  { name: "Jira", description: "Search issues, sprints and epics", category: "Project Management", color: "#0052CC", letter: "J", status: "coming_soon" },
  { name: "Linear", description: "Access issues and project updates", category: "Project Management", color: "#5E6AD2", letter: "L", status: "coming_soon" },
  { name: "Asana", description: "Sync tasks, projects and timelines", category: "Project Management", color: "#F06A6A", letter: "A", status: "coming_soon" },

  // HR
  { name: "BambooHR", description: "Connect HR records and org charts", category: "HR", color: "#73C41D", letter: "B", status: "coming_soon" },
];

const CATEGORIES = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [notified, setNotified] = useState<string | null>(null);

  const filtered = INTEGRATIONS.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const visibleCategories = CATEGORIES.filter((cat) =>
    filtered.some((i) => i.category === cat)
  );

  function handleConnect(name: string) {
    setNotified(name);
    setTimeout(() => setNotified(null), 2500);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Connect your tools</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Link your business apps so WorkBox can answer questions from all your data in one place.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white"
          />
        </div>

        {/* Toast */}
        {notified && (
          <div className="fixed bottom-6 right-6 bg-[#1a3c5e] text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">
            {notified} integration coming soon — we'll notify you when it's ready.
          </div>
        )}

        {/* Categories */}
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
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: integration.color }}
                    >
                      {integration.letter}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{integration.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{integration.description}</p>
                      <button
                        onClick={() => handleConnect(integration.name)}
                        className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#1a3c5e] hover:text-[#1a3c5e] transition-colors"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-12 text-center">No integrations match "{search}"</p>
        )}
      </div>
    </div>
  );
}
