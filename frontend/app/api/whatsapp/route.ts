import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { executeTool, TOOLS, SYSTEM_PROMPT } from "@/lib/agent-runner";
import crypto from "crypto";

/**
 * WhatsApp Cloud API webhook (Meta).
 *
 * GET  — webhook verification handshake: Meta sends hub.mode/hub.verify_token/
 *        hub.challenge; echo the challenge if the token matches.
 * POST — incoming messages. Maps the sender's phone to a WorkBox profile,
 *        runs the same agent as the in-app assistant, replies via Graph API.
 *
 * Env:
 *   WHATSAPP_VERIFY_TOKEN    — any string you choose; entered in Meta's dashboard
 *   WHATSAPP_ACCESS_TOKEN    — Cloud API access token (Meta dashboard)
 *   WHATSAPP_PHONE_NUMBER_ID — the bot number's ID (Meta dashboard, not the number)
 *   META_APP_SECRET          — optional; enables X-Hub-Signature-256 validation
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 5;
const HISTORY_TTL = 86400; // 24 hours
const HISTORY_MAX = 10;
const GRAPH_API = "https://graph.facebook.com/v21.0";

type ChatMessage = { role: "user" | "assistant"; content: string };
type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

const WHATSAPP_SYSTEM_PROMPT = SYSTEM_PROMPT + `

## WhatsApp mode
You are replying via WhatsApp. Keep replies short and conversational — a few sentences at most. You may use *bold* and _italics_ (WhatsApp formatting), but no markdown headers or links in brackets. If an action produces a list, use short lines starting with "- ". Only give a longer reply when the user explicitly asks for detail.`;

/** Webhook verification handshake. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function validSignature(payload: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // validation opt-in until the secret is configured
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header.slice(7)));
  } catch {
    return false;
  }
}

async function sendWhatsApp(to: string, text: string): Promise<void> {
  const body = text.length > 4000 ? text.slice(0, 3997) + "..." : text;
  await fetch(`${GRAPH_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  }).catch(() => {});
}

async function markRead(messageId: string): Promise<void> {
  await fetch(`${GRAPH_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Always 200 quickly — Meta retries and eventually disables webhooks that error
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  // Extract the first text message (statuses/reactions/etc. are ignored)
  const entry = (payload.entry as Array<Record<string, unknown>> | undefined)?.[0];
  const change = (entry?.changes as Array<Record<string, unknown>> | undefined)?.[0];
  const value = change?.value as Record<string, unknown> | undefined;
  const message = (value?.messages as Array<Record<string, unknown>> | undefined)?.[0];

  if (!message || message.type !== "text") {
    return NextResponse.json({ ok: true });
  }

  const fromWaId = message.from as string;                      // e.g. "15551234567" (no +)
  const messageId = message.id as string;
  const messageBody = ((message.text as Record<string, string>)?.body ?? "").trim();
  if (!fromWaId || !messageBody) return NextResponse.json({ ok: true });

  void markRead(messageId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    await sendWhatsApp(fromWaId, "The WorkBox AI isn't configured yet. Ask your admin to set it up.");
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  // Phone-verification handshake: user sends "VERIFY 123456" from their own
  // phone; WhatsApp attests the sender, so this binds the number securely.
  const verifyMatch = messageBody.match(/^verify\s+(\d{6})$/i);
  if (verifyMatch) {
    const code = verifyMatch[1];
    const { data: pv } = await supabase
      .from("phone_verifications")
      .select("id, user_id, expires_at")
      .eq("code", code)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!pv) {
      await sendWhatsApp(fromWaId, "That verification code is invalid or expired. Generate a new one in WorkBox → Settings → Profile.");
      return NextResponse.json({ ok: true });
    }

    const phone = `+${fromWaId}`;
    // Release the number if a different account currently holds it unverified;
    // a verified claim by another account wins and blocks this one.
    const { data: holder } = await supabase.from("profiles")
      .select("id, phone_verified").eq("phone_number", phone).maybeSingle();
    if (holder && holder.id !== pv.user_id) {
      if (holder.phone_verified) {
        await sendWhatsApp(fromWaId, "This WhatsApp number is already verified on another WorkBox account. Unlink it there first.");
        return NextResponse.json({ ok: true });
      }
      await supabase.from("profiles").update({ phone_number: null, phone_verified: false }).eq("id", holder.id);
    }

    const { error: bindErr } = await supabase.from("profiles")
      .update({ phone_number: phone, phone_verified: true }).eq("id", pv.user_id);
    if (bindErr) {
      await sendWhatsApp(fromWaId, "Couldn't link this number right now. Try again in a moment.");
      return NextResponse.json({ ok: true });
    }
    await supabase.from("phone_verifications").update({ used_at: new Date().toISOString() }).eq("id", pv.id);

    const { data: owner } = await supabase.from("profiles").select("full_name").eq("id", pv.user_id).maybeSingle();
    await sendWhatsApp(fromWaId, `✅ Done${owner?.full_name ? ", " + owner.full_name : ""}! This WhatsApp number is now linked to your WorkBox account. Ask me anything — try "what tasks do I have?"`);
    return NextResponse.json({ ok: true });
  }

  // wa_id has no "+"; profiles store numbers like "+15551234567" — try both.
  // Only verified numbers may act on an account.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, organization_id, phone_verified")
    .in("phone_number", [`+${fromWaId}`, fromWaId])
    .maybeSingle();

  if (!profile || !(profile as Record<string, unknown>).phone_verified) {
    await sendWhatsApp(
      fromWaId,
      profile
        ? "This number is linked but not verified yet. Go to WorkBox → Settings → Profile and tap Verify via WhatsApp."
        : "This number isn't linked to a WorkBox account yet. Log in to WorkBox → Settings → Profile → Verify via WhatsApp, then send me the code shown.",
    );
    return NextResponse.json({ ok: true });
  }

  const userId = (profile as Record<string, string>).id;
  const orgId = (profile as Record<string, string | null>).organization_id ?? null;
  const senderName = (profile as Record<string, string>).full_name ?? "User";

  // Conversation history (shared context across messages, 24h TTL)
  const redis = getRedis();
  const historyKey = `wa:${fromWaId}`;
  let history: ChatMessage[] = [];
  if (redis) {
    try {
      const stored = await redis.get<ChatMessage[]>(historyKey);
      if (stored) history = stored;
    } catch { /* ignore cache errors */ }
  }

  history.push({ role: "user", content: messageBody });
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);

  const anthropicMessages: Record<string, unknown>[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let finalReply = "Done.";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 768,
        system: WHATSAPP_SYSTEM_PROMPT,
        tools: TOOLS,
        tool_choice: { type: "auto" },
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      finalReply = "Something went wrong. Try again.";
      break;
    }

    const data = await res.json();
    const content = data.content as AnthropicBlock[];
    const stopReason = data.stop_reason as string;
    const toolUseBlocks = content.filter(b => b.type === "tool_use");

    if (stopReason !== "tool_use" || !toolUseBlocks.length) {
      finalReply = content.find(b => b.type === "text")?.text ?? finalReply;
      break;
    }

    anthropicMessages.push({ role: "assistant", content });

    const toolResults: Record<string, unknown>[] = [];
    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name!, block.input ?? {}, userId, orgId, senderName);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }
    anthropicMessages.push({ role: "user", content: toolResults });
  }

  history.push({ role: "assistant", content: finalReply });
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
  if (redis) {
    try { await redis.set(historyKey, history, { ex: HISTORY_TTL }); } catch { /* ignore */ }
  }

  await sendWhatsApp(fromWaId, finalReply);
  return NextResponse.json({ ok: true });
}
