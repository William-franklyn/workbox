import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SUPPORT_PROMPT = `You are WorkBox Support — a friendly, concise assistant that helps users understand and use WorkBox, a project management and productivity platform.

You help with:
- How to use WorkBox features (tasks, lists, spaces, docs, goals, meetings, spreadsheets, team chat)
- Navigation and UI questions ("where do I find X?")
- Troubleshooting common issues ("why is my task not showing?")
- Getting started and onboarding
- Billing, account, and settings questions
- Best practices for productivity and project management inside WorkBox

## When to escalate
Some questions require live access to the user's actual workspace data — their real tasks, documents, calendar, teammates, etc. You cannot access that data. When a question needs it, respond ONLY with this exact line and nothing else:
[ESCALATE] <one-sentence reason why the WorkBox Agent is better suited>

Escalate when the user asks to:
- List, create, update, or delete their actual tasks/docs/goals/messages
- Check what's due, overdue, or assigned to them
- See their real team members or workspace content
- Take any action inside their workspace
- Analyse or summarise their actual work data

## Response rules
- Be warm, brief, and direct. Two to four sentences max for simple questions.
- Never make up features that don't exist in WorkBox.
- If you don't know something, say so honestly and suggest they contact support.
- Do not answer questions unrelated to work or WorkBox — gently redirect to what you can help with.`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "anon";
  const { success: rlOk, headers: rlHeaders } = await rateLimit(ip, "ai");
  if (!rlOk) return rateLimitResponse(rlHeaders);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const { messages } = await req.json();

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system: SUPPORT_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      return NextResponse.json({ content: "I'm a little busy right now — please try again in a few seconds." });
    }
    return NextResponse.json({ content: "Something went wrong. Please try again." }, { status: res.status });
  }

  const data = await res.json();
  const content: string = (data.content as Array<{ type: string; text?: string }>)
    ?.find(b => b.type === "text")?.text ?? "";

  if (content.startsWith("[ESCALATE]")) {
    const reason = content.replace("[ESCALATE]", "").trim();
    return NextResponse.json({ escalate: true, reason });
  }

  return NextResponse.json({ content });
}
