import { NextRequest, NextResponse } from "next/server";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

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
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  const { messages } = await req.json();

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SUPPORT_PROMPT }, ...messages],
      max_tokens: 512,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  if (content.startsWith("[ESCALATE]")) {
    const reason = content.replace("[ESCALATE]", "").trim();
    return NextResponse.json({ escalate: true, reason });
  }

  return NextResponse.json({ content });
}
