import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { executeTool, TOOLS, SYSTEM_PROMPT } from "@/lib/agent-runner";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 5;

type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success: rlOk, headers: rlHeaders } = await rateLimit(user.id, "ai");
    if (!rlOk) return rateLimitResponse(rlHeaders);

    const userId = user.id;
    const svcClient = createServiceClient();
    const { data: profile } = await svcClient.from("profiles")
      .select("organization_id, full_name").eq("id", userId).maybeSingle();
    const orgId = (profile as Record<string, unknown> | null)?.organization_id as string | null ?? null;
    const senderName = (profile as Record<string, string> | null)?.full_name ?? user.email?.split("@")[0] ?? "User";

    const { messages } = await req.json();
    // Anthropic doesn't accept system in the messages array — it's a top-level param
    const anthropicMessages: Record<string, unknown>[] = (messages as Record<string, unknown>[])
      .slice(-12)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

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
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          tool_choice: { type: "auto" },
          messages: anthropicMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = (err as Record<string, Record<string, string>>).error?.message ?? `HTTP ${res.status}`;
        return NextResponse.json({ content: `Something went wrong: ${errMsg}` });
      }

      const data = await res.json();
      const content = data.content as AnthropicBlock[];
      const stopReason = data.stop_reason as string;

      const toolUseBlocks = content.filter((b) => b.type === "tool_use");

      // No tool calls — return final text
      if (stopReason !== "tool_use" || !toolUseBlocks.length) {
        const text = content.find((b) => b.type === "text")?.text;
        return NextResponse.json({ content: text || "I've completed the requested actions." });
      }

      // Add assistant turn (includes tool_use blocks)
      anthropicMessages.push({ role: "assistant", content });

      // Execute all tools, gather results into a single user turn
      const toolResults: Record<string, unknown>[] = [];
      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name!, block.input ?? {}, userId, orgId, senderName);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      anthropicMessages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({ content: "I've completed the requested actions." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[agent] error:", msg);
    return NextResponse.json({ error: msg || "Unexpected server error" }, { status: 500 });
  }
}
