import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { executeTool, TOOLS, SYSTEM_PROMPT } from "@/lib/agent-runner";
import crypto from "crypto";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 5;
const SMS_HISTORY_TTL = 86400; // 24 hours
const SMS_HISTORY_MAX = 10;

type ChatMessage = { role: "user" | "assistant"; content: string };
type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function twiml(text: string): Response {
  const safe = xmlEscape(text.length > 1600 ? text.slice(0, 1597) + "..." : text);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const sortedKeys = Object.keys(params).sort();
  const str = url + sortedKeys.map(k => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", authToken).update(str, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

const SMS_SYSTEM_PROMPT = SYSTEM_PROMPT + `

## SMS mode
You are replying via SMS. Keep every reply under 320 characters whenever possible. Use short sentences, no markdown. If an action produces a list, summarise it (e.g. "3 tasks: Buy milk, Call Bob, Review doc"). Only give a longer reply when the user explicitly asks for detail.`;

export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = Object.fromEntries(new URLSearchParams(text));

  const fromPhone = params.From?.trim();
  const messageBody = params.Body?.trim();

  if (!fromPhone || !messageBody) return twiml("Invalid request.");

  // Validate Twilio signature when auth token is configured
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";
    const webhookUrl = `${appUrl}/api/sms`;
    if (!validateTwilioSignature(authToken, webhookUrl, params, signature)) {
      return twiml("Unauthorized.");
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return twiml("AI not configured.");
  }

  // Look up user by phone number
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, organization_id")
    .eq("phone_number", fromPhone)
    .maybeSingle();

  if (!profile) {
    return twiml(
      "Your phone number isn't linked to a WorkBox account. Go to Settings → Profile and add your number.",
    );
  }

  const userId = (profile as Record<string, string>).id;
  const orgId = (profile as Record<string, string | null>).organization_id ?? null;
  const senderName = (profile as Record<string, string>).full_name ?? "User";

  // Load SMS conversation history from Redis
  const redis = getRedis();
  const historyKey = `sms:${fromPhone}`;
  let history: ChatMessage[] = [];
  if (redis) {
    try {
      const stored = await redis.get<ChatMessage[]>(historyKey);
      if (stored) history = stored;
    } catch { /* ignore cache errors */ }
  }

  history.push({ role: "user", content: messageBody });
  if (history.length > SMS_HISTORY_MAX) history = history.slice(-SMS_HISTORY_MAX);

  // Run the agent loop
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
        max_tokens: 512,
        system: SMS_SYSTEM_PROMPT,
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

  // Persist updated history
  history.push({ role: "assistant", content: finalReply });
  if (history.length > SMS_HISTORY_MAX) history = history.slice(-SMS_HISTORY_MAX);
  if (redis) {
    try { await redis.set(historyKey, history, { ex: SMS_HISTORY_TTL }); } catch { /* ignore */ }
  }

  return twiml(finalReply);
}
