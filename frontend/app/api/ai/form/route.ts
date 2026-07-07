import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const { description } = await req.json();
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: `You generate form field definitions as JSON. Return ONLY a valid JSON object with keys "name", "description", and "fields". No markdown, no explanation.

Field schema:
- id: unique string like "f1", "f2"
- type: "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "checkbox" | "rating" | "heading"
- label: clear label
- placeholder: helpful hint (omit for checkbox, date, rating, heading)
- required: boolean
- options: string array (select and radio only)
- maps_to: "title" | "description" | null (tag the most relevant field)

Rules: 5-10 fields max. Always include an email field if it makes sense. Use heading fields to group sections for longer forms. rating = 1-5 stars.`,
      messages: [{
        role: "user",
        content: `Create a form for: ${description}`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: (err as Record<string, Record<string, string>>).error?.message ?? "AI error" }, { status: 500 });
  }

  const data = await res.json();
  const text = (data.content as Array<{ type: string; text?: string }>)
    ?.find(b => b.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text.trim());
    return NextResponse.json(parsed);
  } catch {
    // Try to extract JSON from the response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]));
      } catch { /* fall through */ }
    }
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }
}
