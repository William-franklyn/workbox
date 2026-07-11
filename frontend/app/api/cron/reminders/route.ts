import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Proactive engagement cron. Fires:
 *  - sticky-note reminders whose time has arrived
 *  - "due today / overdue" task nudges
 * Delivery: in-app notification (always, free) + best-effort WhatsApp (only
 * reaches users inside the 24h service window; out-of-window sends just fail,
 * no charge). Idempotent via the sticky_notes.reminded flag and a per-day
 * task-nudge notification id.
 */

const GRAPH_API = "https://graph.facebook.com/v21.0";

async function sendWhatsApp(toWaId: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  await fetch(`${GRAPH_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: toWaId, type: "text", text: { body } }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  let stickyFired = 0, taskNudges = 0;

  // 1. Sticky-note reminders that are due and not yet delivered
  const { data: dueNotes } = await svc.from("sticky_notes")
    .select("id, user_id, content")
    .lte("remind_at", nowIso).eq("reminded", false).not("remind_at", "is", null)
    .limit(200);

  for (const n of dueNotes ?? []) {
    const text = (n.content || "your note").slice(0, 140);
    await svc.from("notifications").insert({
      id: `rem${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      user_id: n.user_id, type: "reminder", title: "⏰ Reminder", body: text,
    });
    const { data: prof } = await svc.from("profiles").select("phone_number, phone_verified").eq("id", n.user_id).maybeSingle();
    if (prof?.phone_verified && prof.phone_number) {
      await sendWhatsApp(prof.phone_number.replace("+", ""), `⏰ Reminder: ${text}`);
    }
    await svc.from("sticky_notes").update({ reminded: true }).eq("id", n.id);
    stickyFired++;
  }

  // 2. Task "due today / overdue" nudges — one notification per user per day
  const { data: tasks } = await svc.from("tasks")
    .select("assignee_id, created_by, title, due_date, status")
    .lte("due_date", today).neq("status", "done").not("due_date", "is", null)
    .limit(1000);

  const byUser: Record<string, { overdue: number; today: number }> = {};
  for (const t of tasks ?? []) {
    const uid = t.assignee_id ?? t.created_by;
    if (!uid) continue;
    byUser[uid] ??= { overdue: 0, today: 0 };
    if (t.due_date < today) byUser[uid].overdue++; else byUser[uid].today++;
  }

  for (const [uid, c] of Object.entries(byUser)) {
    const nudgeId = `due-${today}-${uid.slice(0, 12)}`; // dedupe per day
    const { data: exists } = await svc.from("notifications").select("id").eq("id", nudgeId).maybeSingle();
    if (exists) continue;

    const parts = [];
    if (c.today) parts.push(`${c.today} due today`);
    if (c.overdue) parts.push(`${c.overdue} overdue`);
    const body = `You have ${parts.join(" and ")}.`;

    const { data: pref } = await svc.from("notification_prefs").select("notify_due_soon").eq("user_id", uid).maybeSingle();
    if (pref && pref.notify_due_soon === false) continue;

    await svc.from("notifications").insert({ id: nudgeId, user_id: uid, type: "reminder", title: "📋 Tasks need attention", body });
    const { data: prof } = await svc.from("profiles").select("phone_number, phone_verified, full_name").eq("id", uid).maybeSingle();
    if (prof?.phone_verified && prof.phone_number) {
      await sendWhatsApp(prof.phone_number.replace("+", ""), `Good day${prof.full_name ? ", " + prof.full_name.split(" ")[0] : ""}! ${body} Open WorkBox to catch up.`);
    }
    taskNudges++;
  }

  return NextResponse.json({ ok: true, stickyFired, taskNudges });
}
