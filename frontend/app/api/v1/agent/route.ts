import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";
import { executeTool, TOOLS, SYSTEM_PROMPT } from "@/lib/agent-runner";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 5;

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

/**
 * POST /api/v1/agent  { prompt } — run the WorkBox AI agent (same tools as the
 * in-app and WhatsApp assistants) and return its reply. Powers the browser
 * extension's ask/act popup.
 */
export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id, full_name").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id ?? null;
  const name = profile?.full_name ?? "User";

  const messages: Record<string, unknown>[] = [{ role: "user", content: prompt }];
  let reply = "Done.";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, tools: TOOLS, tool_choice: { type: "auto" }, messages }),
    });
    if (!res.ok) { reply = "Something went wrong talking to the AI."; break; }

    const data = await res.json();
    const content = data.content as Block[];
    const toolUse = content.filter((b) => b.type === "tool_use");

    if (data.stop_reason !== "tool_use" || !toolUse.length) {
      reply = content.find((b) => b.type === "text")?.text ?? reply;
      break;
    }

    messages.push({ role: "assistant", content });
    const results: Record<string, unknown>[] = [];
    for (const block of toolUse) {
      const r = await executeTool(block.name!, block.input ?? {}, userId, orgId, name);
      results.push({ type: "tool_result", tool_use_id: block.id, content: r });
    }
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ reply });
}
