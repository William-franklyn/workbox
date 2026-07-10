import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/** Short AI insight for a chart's summarized numbers (Reports page). */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, headers } = await rateLimit(user.id, "ai");
  if (!success) return rateLimitResponse(headers);

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return NextResponse.json({ text: "AI is not configured." });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 220,
      system: "You are a concise data analyst. Given chart data, reply with at most two short, specific, non-obvious insights. No preamble, no restating the numbers verbatim.",
      messages: [{ role: "user", content: prompt.slice(0, 2000) }],
    }),
  });

  if (!res.ok) return NextResponse.json({ text: "Couldn't generate an insight right now." });
  const data = await res.json();
  const text = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "No insight available.";
  return NextResponse.json({ text });
}
