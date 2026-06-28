"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar, Plus, RefreshCw, Link2, Video, Users, ChevronRight,
  Clock, Loader2, X, Check, AlertCircle, ExternalLink, Copy,
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
}

interface TaskList {
  id: string;
  name: string;
  space?: { name: string };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

// ─── Schedule Meeting Modal ───────────────────────────────────────────────────
function ScheduleModal({
  lists,
  onClose,
  onCreated,
}: {
  lists: TaskList[];
  onClose: () => void;
  onCreated: (ev: GCalEvent) => void;
}) {
  const today = new Date();
  const defaultDate = today.toISOString().split("T")[0];
  const defaultTime = `${String(today.getHours() + 1).padStart(2, "0")}:00`;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultTime);
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");
  const [addMeet, setAddMeet] = useState(true);
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(start.getTime() + Number(duration) * 60 * 1000);
    const attendeeEmails = attendees.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          attendeeEmails,
          addMeetLink: addMeet,
          listId: listId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create meeting"); setSaving(false); return; }
      onCreated(data.event);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: "var(--accent-purple)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Schedule Meeting
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-secondary)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          {error && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "#ef444422", color: "#ef4444" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <input
            placeholder="Meeting title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border focus:ring-2 focus:ring-purple-500/30"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)", colorScheme: "dark" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Start time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)", colorScheme: "dark" }} />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Duration</label>
            <select value={duration} onChange={e => setDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>
              Attendees <span className="opacity-60">(emails, comma-separated)</span>
            </label>
            <input
              placeholder="name@example.com, name2@example.com"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border resize-none"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          {/* Options */}
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div onClick={() => setAddMeet(!addMeet)}
                className="w-4 h-4 rounded flex items-center justify-center border transition-colors"
                style={{
                  background: addMeet ? "var(--accent-purple)" : "transparent",
                  borderColor: addMeet ? "var(--accent-purple)" : "var(--border)",
                }}>
                {addMeet && <Check size={10} color="white" />}
              </div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Add Google Meet video link
              </span>
            </label>

            {lists.length > 0 && (
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Also add as WorkBox task in
                </label>
                <select value={listId} onChange={e => setListId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="">— Don't create task —</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>{l.space?.name ? `${l.space.name} / ` : ""}{l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving}
            className="mt-1 w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: "var(--accent-purple)" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            {saving ? "Creating…" : "Create Meeting"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ ev }: { ev: GCalEvent }) {
  const [copied, setCopied] = useState(false);
  const isAllDay = !ev.start.dateTime;

  function copyLink() {
    navigator.clipboard.writeText(ev.hangoutLink ?? ev.htmlLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group flex items-start gap-3 px-4 py-3 rounded-xl border hover:border-purple-500/40 transition-colors"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      {/* Time column */}
      <div className="shrink-0 text-right w-20">
        {isAllDay ? (
          <span className="text-xs font-medium" style={{ color: "var(--accent-purple)" }}>All day</span>
        ) : (
          <>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatTime(ev.start.dateTime!)}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {formatTime(ev.end.dateTime!)}
            </p>
          </>
        )}
      </div>

      {/* Purple divider */}
      <div className="w-0.5 self-stretch rounded-full mt-0.5 shrink-0" style={{ background: "var(--accent-purple)", opacity: 0.5 }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{ev.summary}</p>

        {ev.attendees && ev.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Users size={11} style={{ color: "var(--text-secondary)" }} />
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {ev.attendees.map(a => a.displayName || a.email).join(", ")}
            </span>
          </div>
        )}

        {ev.description && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-secondary)" }}>
            {ev.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {ev.hangoutLink && (
          <a href={ev.hangoutLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: "#00897b" }}>
            <Video size={11} /> Join
          </a>
        )}
        <button onClick={copyLink}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-secondary)" }}
          title={ev.hangoutLink ? "Copy Meet link" : "Copy event link"}>
          {copied ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
        </button>
        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-secondary)" }} title="Open in Google Calendar">
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setJustConnected(true);
      router.replace("/meetings");
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        setConnectedEmail(d.email);
        if (d.connected) loadEvents();
        else setLoading(false);
      });

    fetch("/api/workspace")
      .then(r => r.json())
      .then(d => setLists(d.lists ?? []))
      .catch(() => {});
  }, []);

  function loadEvents(quiet = false) {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    fetch("/api/google-calendar")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setEvents(d);
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar?")) return;
    setDisconnecting(true);
    await fetch("/api/google-calendar/status", { method: "DELETE" });
    setConnected(false);
    setConnectedEmail(null);
    setEvents([]);
    setDisconnecting(false);
  }

  function handleCreated(ev: GCalEvent) {
    setEvents(prev => {
      const next = [...prev, ev].sort((a, b) => {
        const aTime = a.start.dateTime ?? a.start.date ?? "";
        const bTime = b.start.dateTime ?? b.start.date ?? "";
        return aTime.localeCompare(bTime);
      });
      return next;
    });
    setShowModal(false);
  }

  const grouped = groupByDay(events);
  const sortedDays = Object.keys(grouped).sort();

  // ── Not connected ──────────────────────────────────────────────────────────
  if (connected === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        {justConnected && (
          <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium"
            style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
            <Check size={14} /> Connected to Google Calendar!
          </div>
        )}

        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "rgba(124,58,237,0.15)" }}>
          📅
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Connect Google Calendar
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Schedule meetings, view upcoming events, and sync them as tasks — all without leaving WorkBox.
          </p>
        </div>
        <a href="/api/auth/google/redirect"
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: "var(--accent-purple)" }}>
          <Calendar size={16} /> Connect Google Calendar
        </a>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (connected === null || (loading && connected)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Just-connected toast */}
      {justConnected && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
          <Check size={14} /> Google Calendar connected! Your upcoming meetings are shown below.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Meetings</h1>
          {connectedEmail && (
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              {connectedEmail}
              <button onClick={disconnect} disabled={disconnecting}
                className="ml-2 hover:underline text-xs" style={{ color: "var(--text-secondary)" }}>
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
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

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {sortedDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Calendar size={36} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No upcoming meetings in the next 30 days.
            </p>
            <button onClick={() => setShowModal(true)}
              className="text-sm font-medium flex items-center gap-1.5 hover:underline"
              style={{ color: "var(--accent-purple)" }}>
              <Plus size={14} /> Schedule one
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-2xl">
            {sortedDays.map(day => (
              <div key={day}>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: "var(--text-secondary)" }}>
                  {dayLabel(day)}
                </h3>
                <div className="flex flex-col gap-2">
                  {grouped[day].map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ScheduleModal
          lists={lists}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
