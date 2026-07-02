"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { useTasksStore } from "@/store/tasks";
import {
  Calendar, Plus, RefreshCw, Video, Users,
  Loader2, X, Check, AlertCircle, ExternalLink, Copy, ClipboardList,
} from "lucide-react";

interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  htmlLink: string;
  status: string;
  source?: "google" | "outlook";
}

interface MSCalEvent {
  id: string;
  subject: string;
  body?: { content: string; contentType: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { emailAddress: { address: string; name?: string }; status?: { response: string } }[];
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl: string };
  webLink: string;
  isAllDay?: boolean;
  source?: "outlook";
}

interface TaskList {
  id: string;
  name: string;
  space?: { name: string };
}

function msEventToGCal(ev: MSCalEvent | GCalEvent): GCalEvent {
  if ("subject" in ev) {
    const toUTC = (dt: string) => (dt.endsWith("Z") ? dt : dt + "Z");
    return {
      id: `outlook:${ev.id}`,
      summary: ev.subject,
      description: ev.body?.content,
      start: ev.isAllDay
        ? { date: ev.start.dateTime.split("T")[0] }
        : { dateTime: toUTC(ev.start.dateTime) },
      end: ev.isAllDay
        ? { date: ev.end.dateTime.split("T")[0] }
        : { dateTime: toUTC(ev.end.dateTime) },
      attendees: (ev.attendees ?? []).map((a) => ({
        email: a.emailAddress.address,
        displayName: a.emailAddress.name,
        responseStatus: a.status?.response ?? "none",
      })),
      hangoutLink: ev.onlineMeeting?.joinUrl ?? undefined,
      htmlLink: ev.webLink,
      status: "confirmed",
      source: "outlook",
    };
  }
  return { ...ev, source: "outlook" };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function stripHtml(raw: string): string {
  return (raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function groupByDay(events: GCalEvent[]) {
  const groups: Record<string, GCalEvent[]> = {};
  for (const ev of events) {
    const dt = ev.start.dateTime ?? ev.start.date ?? "";
    const day = dt.split("T")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(ev);
  }
  return groups;
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function findConflicts(startISO: string, endISO: string, events: GCalEvent[]): GCalEvent[] {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  return events.filter(ev => {
    if (!ev.start.dateTime || !ev.end.dateTime) return false;
    const es = new Date(ev.start.dateTime).getTime();
    const ee = new Date(ev.end.dateTime).getTime();
    return s < ee && e > es;
  });
}

function ScheduleModal({ lists, events, onClose, onCreated, calendarProvider }: {
  lists: TaskList[];
  events: GCalEvent[];
  onClose: () => void;
  onCreated: (ev: GCalEvent) => void;
  calendarProvider: "google" | "outlook";
}) {
  const today = new Date();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today.toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(`${String(today.getHours() + 1).padStart(2, "0")}:00`);
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");
  const [addMeet, setAddMeet] = useState(true);
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const proposedStart = date && startTime ? new Date(`${date}T${startTime}:00`) : null;
  const proposedEnd = proposedStart ? new Date(proposedStart.getTime() + Number(duration) * 60 * 1000) : null;
  const conflicts = proposedStart && proposedEnd
    ? findConflicts(proposedStart.toISOString(), proposedEnd.toISOString(), events)
    : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (conflicts.length > 0 && !confirmed) { setError("Please confirm you want to schedule despite the conflict."); return; }

    const start = proposedStart!;
    const end = proposedEnd!;
    const attendeeEmails = attendees.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    setSaving(true); setError("");
    try {
      const isGoogle = calendarProvider === "google";
      const endpoint = isGoogle ? "/api/google-calendar" : "/api/outlook-calendar";
      const body = isGoogle
        ? { title: title.trim(), description: description.trim(), startDateTime: start.toISOString(), endDateTime: end.toISOString(), attendeeEmails, addMeetLink: addMeet, listId: listId || null }
        : { title: title.trim(), description: description.trim(), startDateTime: start.toISOString(), endDateTime: end.toISOString(), attendeeEmails, addTeamsLink: addMeet };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create meeting"); setSaving(false); return; }

      const event: GCalEvent = isGoogle ? data.event : (data.event as GCalEvent);
      onCreated(event);
    } catch { setError("Network error. Please try again."); setSaving(false); }
  }

  const meetLabel = calendarProvider === "google" ? "Add Google Meet video link" : "Add Microsoft Teams link";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: "var(--accent-purple)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Schedule Meeting</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#ef444422", color: "#ef4444" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: "#f59e0b22", border: "1px solid #f59e0b44", color: "#f59e0b" }}>
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <AlertCircle size={13} /> Time conflict detected
              </div>
              <ul className="space-y-0.5 mb-2">
                {conflicts.map(c => (
                  <li key={c.id} className="opacity-80">
                    • {c.summary} ({formatTime(c.start.dateTime!)} – {formatTime(c.end.dateTime!)})
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <div onClick={() => setConfirmed(!confirmed)}
                  className="w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors shrink-0"
                  style={{ background: confirmed ? "#f59e0b" : "transparent", borderColor: "#f59e0b" }}>
                  {confirmed && <Check size={9} color="white" />}
                </div>
                <span>Schedule anyway</span>
              </label>
            </div>
          )}

          <input placeholder="Meeting title *" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Date</label>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); setConfirmed(false); }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)", colorScheme: "dark" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Start time</label>
              <input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setConfirmed(false); }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)", colorScheme: "dark" }} />
            </div>
          </div>

          <select value={duration} onChange={e => { setDuration(e.target.value); setConfirmed(false); }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
          </select>

          <input placeholder="Attendees (emails, comma-separated)" value={attendees} onChange={e => setAttendees(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />

          <textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)}
            rows={2} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border resize-none"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={() => setAddMeet(!addMeet)}
              className="w-4 h-4 rounded flex items-center justify-center border transition-colors"
              style={{ background: addMeet ? "var(--accent-purple)" : "transparent", borderColor: addMeet ? "var(--accent-purple)" : "var(--border)" }}>
              {addMeet && <Check size={10} color="white" />}
            </div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{meetLabel}</span>
          </label>

          {calendarProvider === "google" && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Add as task in</label>
              <select value={listId} onChange={e => setListId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="">— Don&apos;t create task —</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.space?.name ? `${l.space.name} / ` : ""}{l.name}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={saving || (conflicts.length > 0 && !confirmed)}
            className="mt-1 w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: conflicts.length > 0 && !confirmed ? "#f59e0b" : "var(--accent-purple)" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            {saving ? "Creating…" : conflicts.length > 0 && !confirmed ? "Confirm conflict first" : "Create Meeting"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source?: "google" | "outlook" }) {
  if (source === "outlook") {
    return (
      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
        style={{ background: "#0078D422", color: "#0078D4" }}>OL</span>
    );
  }
  return null;
}

function EventCard({ ev, synced }: { ev: GCalEvent; synced: boolean }) {
  const [copied, setCopied] = useState(false);
  const isAllDay = !ev.start.dateTime;

  function copyLink() {
    navigator.clipboard.writeText(ev.hangoutLink ?? ev.htmlLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const calendarLabel = ev.source === "outlook" ? "Open in Outlook Calendar" : "Open in Google Calendar";

  return (
    <div className="group flex items-start gap-3 px-4 py-3 rounded-xl border hover:border-purple-500/40 transition-colors"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      <div className="shrink-0 text-right w-20">
        {isAllDay ? (
          <span className="text-xs font-medium" style={{ color: "var(--accent-purple)" }}>All day</span>
        ) : (
          <>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{formatTime(ev.start.dateTime!)}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatTime(ev.end.dateTime!)}</p>
          </>
        )}
      </div>

      <div className="w-0.5 self-stretch rounded-full mt-0.5 shrink-0" style={{ background: "var(--accent-purple)", opacity: 0.5 }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{ev.summary}</p>
          <SourceBadge source={ev.source} />
        </div>
        {ev.attendees && ev.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Users size={11} style={{ color: "var(--text-secondary)" }} />
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {ev.attendees.map(a => a.displayName || a.email).join(", ")}
            </span>
          </div>
        )}
        {ev.description && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{stripHtml(ev.description)}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {synced && (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
            style={{ background: "#22c55e18", color: "#22c55e" }}>
            <Check size={11} /> In Tasks
          </span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {ev.hangoutLink && (
            <a href={ev.hangoutLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: ev.source === "outlook" ? "#0078D4" : "#00897b" }}>
              <Video size={11} /> Join
            </a>
          )}
          <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-secondary)" }} title="Copy link">
            {copied ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
          </button>
          <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-secondary)" }} title={calendarLabel}>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { personalListId } = useWorkspaceStore();
  const { reloadTasks } = useTasksStore();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [outlookConnected, setOutlookConnected] = useState<boolean | null>(null);
  const [outlookEmail, setOutlookEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [syncListId, setSyncListId] = useState("");
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [justOutlookConnected, setJustOutlookConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ count: number; listName: string; listId: string } | null>(null);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setJustConnected(true);
      router.replace("/meetings");
    }
    if (searchParams.get("outlook_connected") === "1") {
      setJustOutlookConnected(true);
      router.replace("/meetings");
    }
  }, [searchParams, router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/google-calendar/status").then(r => r.json()).catch(() => ({ connected: false })),
      fetch("/api/outlook-calendar/status").then(r => r.json()).catch(() => ({ connected: false })),
    ]).then(([gcal, outlook]) => {
      setConnected(gcal.connected);
      setConnectedEmail(gcal.email ?? null);
      setOutlookConnected(outlook.connected);
      setOutlookEmail(outlook.email ?? null);

      if (gcal.connected || outlook.connected) {
        loadEvents(false, gcal.connected, outlook.connected);
        loadSynced();
      } else {
        setLoading(false);
      }
    });

    fetch("/api/workspace")
      .then(r => r.json())
      .then(d => {
        const ls = d.lists ?? [];
        setLists(ls);
        const preferred = personalListId && ls.find((l: TaskList) => l.id === personalListId);
        setSyncListId(preferred ? preferred.id : (ls[0]?.id ?? ""));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (personalListId && lists.length > 0 && !syncListId) {
      const found = lists.find(l => l.id === personalListId);
      if (found) setSyncListId(found.id);
    }
  }, [personalListId, lists]);

  useEffect(() => {
    if (events.length === 0 || !syncListId) return;
    const unsynced = events.filter(ev => !syncedIds.has(ev.id));
    if (unsynced.length === 0) return;
    const listName = lists.find(l => l.id === syncListId)?.name ?? "your task list";
    setAutoSyncing(true);
    Promise.all(
      unsynced.map(ev => {
        const isOutlook = ev.id.startsWith("outlook:");
        const endpoint = isOutlook ? "/api/outlook-calendar/sync" : "/api/google-calendar/sync";
        return fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googleEventId: ev.id,
            title: ev.summary,
            description: ev.description,
            startDateTime: ev.start.dateTime ?? null,
            endDateTime: ev.end.dateTime ?? null,
            dueDate: (ev.start.dateTime ?? ev.start.date ?? "").split("T")[0] || null,
            meetLink: ev.hangoutLink ?? null,
            calendarLink: ev.htmlLink,
            listId: syncListId,
          }),
        }).then(async r => {
          if (!r.ok) return null;
          return ev.id;
        });
      })
    ).then(results => {
      const confirmed = results.filter(Boolean) as string[];
      if (confirmed.length > 0) setSyncedIds(prev => new Set([...prev, ...confirmed]));
      const newCount = confirmed.filter(id => !syncedIds.has(id)).length;
      if (newCount > 0) {
        setSyncResult({ count: newCount, listName, listId: syncListId });
        setTimeout(() => setSyncResult(null), 8000);
      }
      if (syncListId) reloadTasks(syncListId);
    }).finally(() => setAutoSyncing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, syncListId]);

  function loadEvents(quiet = false, gcalConn = connected, outlookConn = outlookConnected) {
    if (!quiet) setLoading(true); else setRefreshing(true);
    const fetches: Promise<GCalEvent[]>[] = [];

    if (gcalConn) {
      fetches.push(
        fetch("/api/google-calendar")
          .then(r => r.ok ? r.json() : [])
          .then(d => (Array.isArray(d) ? d.map((e: GCalEvent) => ({ ...e, source: "google" as const })) : []))
          .catch(() => [])
      );
    }
    if (outlookConn) {
      fetches.push(
        fetch("/api/outlook-calendar")
          .then(r => r.ok ? r.json() : [])
          .then(d => (Array.isArray(d) ? d as GCalEvent[] : []))
          .catch(() => [])
      );
    }

    Promise.all(fetches)
      .then(results => {
        const merged = results.flat().sort((a, b) =>
          (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "")
        );
        setEvents(merged);
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  function loadSynced() {
    fetch("/api/google-calendar/sync")
      .then(r => r.json())
      .then((d: { google_event_id: string }[]) => {
        setSyncedIds(new Set(d.map(x => x.google_event_id)));
      })
      .catch(() => {});
  }

  async function disconnectGoogle() {
    if (!confirm("Disconnect Google Calendar?")) return;
    setDisconnecting(true);
    await fetch("/api/google-calendar/status", { method: "DELETE" });
    setConnected(false); setConnectedEmail(null);
    if (!outlookConnected) setEvents([]);
    else loadEvents(true, false, outlookConnected);
    setDisconnecting(false);
  }

  async function disconnectOutlook() {
    if (!confirm("Disconnect Outlook Calendar?")) return;
    setDisconnecting(true);
    await fetch("/api/outlook-calendar/status", { method: "DELETE" });
    setOutlookConnected(false); setOutlookEmail(null);
    if (!connected) setEvents([]);
    else loadEvents(true, connected, false);
    setDisconnecting(false);
  }

  function handleCreated(ev: GCalEvent) {
    setEvents(prev => [...prev, ev].sort((a, b) =>
      (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "")
    ));
    setShowModal(false);
  }

  const anyConnected = connected || outlookConnected;
  const calendarProvider: "google" | "outlook" = connected ? "google" : "outlook";
  const grouped = groupByDay(events);
  const sortedDays = Object.keys(grouped).sort();

  // Still loading statuses
  if (connected === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  if (!anyConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "rgba(124,58,237,0.15)" }}>📅</div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Connect a calendar</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Schedule meetings, view upcoming events, and sync them as tasks — all without leaving WorkBox.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <a href="/api/auth/google/redirect"
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: "#4285F4" }}>
            <Calendar size={15} /> Google Calendar
          </a>
          <a href="/api/auth/microsoft/redirect"
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: "#0078D4" }}>
            <Calendar size={15} /> Outlook Calendar
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {justConnected && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
          <Check size={14} /> Google Calendar connected! Your upcoming meetings are shown below.
        </div>
      )}

      {justOutlookConnected && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
          <Check size={14} /> Outlook Calendar connected! Your upcoming meetings are shown below.
        </div>
      )}

      {syncResult && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
          <Check size={14} />
          <span className="flex-1">
            {syncResult.count} meeting{syncResult.count !== 1 ? "s" : ""} added as tasks in <strong>{syncResult.listName}</strong>
          </span>
          <button onClick={() => router.push(`/tasks/${syncResult.listId}?view=calendar`)}
            className="text-xs underline hover:opacity-70 transition-opacity shrink-0">
            View in Calendar →
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Meetings</h1>
          <div className="flex flex-col gap-0.5 mt-0.5">
            {connectedEmail && (
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                {connectedEmail}
                <button onClick={disconnectGoogle} disabled={disconnecting} className="ml-2 hover:underline text-xs" style={{ color: "var(--text-secondary)" }}>
                  Disconnect
                </button>
              </p>
            )}
            {outlookEmail && (
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#0078D4" }} />
                {outlookEmail}
                <button onClick={disconnectOutlook} disabled={disconnecting} className="ml-2 hover:underline text-xs" style={{ color: "var(--text-secondary)" }}>
                  Disconnect
                </button>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lists.length > 0 && (
            <div className="flex items-center gap-1.5">
              <ClipboardList size={13} style={{ color: "var(--text-secondary)" }} />
              <select value={syncListId} onChange={e => setSyncListId(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border outline-none"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                title="Default list for syncing meetings as tasks">
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {autoSyncing && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Loader2 size={12} className="animate-spin" /> Syncing…
            </span>
          )}
          <button onClick={() => loadEvents(true)} disabled={refreshing}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-secondary)" }} title="Refresh">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--accent-purple)" }}>
            <Plus size={15} /> Schedule Meeting
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {sortedDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Calendar size={36} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No upcoming meetings in the next 30 days.</p>
            <button onClick={() => setShowModal(true)}
              className="text-sm font-medium flex items-center gap-1.5 hover:underline" style={{ color: "var(--accent-purple)" }}>
              <Plus size={14} /> Schedule one
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-2xl">
            {sortedDays.map(day => (
              <div key={day}>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>
                  {dayLabel(day)}
                </h3>
                <div className="flex flex-col gap-2">
                  {grouped[day].map(ev => (
                    <EventCard key={ev.id} ev={ev} synced={syncedIds.has(ev.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ScheduleModal
          lists={lists}
          events={events}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
          calendarProvider={calendarProvider}
        />
      )}
    </div>
  );
}
