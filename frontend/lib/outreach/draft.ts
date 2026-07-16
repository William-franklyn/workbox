import { searchKnowledge } from "@/lib/knowledge/ingest";

/**
 * AI outreach email drafting — generalized from Advisor Vantage's lib/draft.ts.
 * Instead of one hardcoded persona, it ghostwrites in the sending user's voice
 * and optionally grounds the email in the org's own documents (pgvector RAG).
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const TOP_K = 4;

export interface EmailDraft {
  subject: string;
  body: string;
  word_count: number;
}

export class DraftPlaceholderError extends Error {
  constructor() {
    super("Draft contained unresolved placeholders");
    this.name = "DraftPlaceholderError";
  }
}

export interface DraftParams {
  orgId: string | null;
  sender: { name: string; company?: string | null; signature?: string | null };
  contact: { first_name: string; last_name?: string | null; job_title?: string | null; company?: string | null };
  intent: string;               // what the user wants to say / offer
  tone?: string;                // e.g. "warm", "concise", "formal"
  useMergeTag?: boolean;        // greet with {{first_name}} for bulk sends
}

export async function generateOutreachEmail(params: DraftParams): Promise<EmailDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    throw new Error("AI is not configured");
  }

  const first = (params.contact.first_name ?? "there").split(" ")[0];
  const greeting = params.useMergeTag ? "{{first_name}}" : first;

  // Optional RAG: ground the email in the org's knowledge platform.
  // Drafting is a member+ action (guests can't reach these routes), so a
  // fixed non-guest role is safe — the RPC only gates on guest vs not,
  // and p_user is unused for non-guests.
  let context = "";
  if (params.orgId) {
    const query = `${params.intent} ${params.contact.company ?? ""} ${params.contact.job_title ?? ""}`.trim();
    const chunks = await searchKnowledge(
      { orgId: params.orgId, userId: "00000000-0000-0000-0000-000000000000", role: "member" },
      query,
      TOP_K,
    ).catch(() => null);
    if (chunks?.length) {
      context = "\n\nRELEVANT CONTEXT FROM YOUR WORKSPACE (use naturally, don't quote verbatim):\n" +
        chunks.map((c, i) => `[${i + 1}] ${c.content.slice(0, 400)}`).join("\n");
    }
  }

  const senderCompany = params.sender.company ? ` at ${params.sender.company}` : "";
  const signature = params.sender.signature?.trim() || `Best,\n${params.sender.name}`;

  const system = `You are a ghostwriter for ${params.sender.name}${senderCompany}. Write a short, personal outreach email in their voice — direct, human, and specific. It should read like a real person wrote it, not a template.${context}

MANDATORY OUTPUT FORMAT — return exactly this and nothing else:
SUBJECT: [subject line]

${greeting}, [email body]

${signature}

RULES:
- Greet with "${greeting}" only — never "Dear Mr./Ms.".
- Never open with "I hope this finds you well", "My name is", or "I am reaching out".
- 50–120 words in the body. One clear, soft call to action at the end.
- ${params.tone ? `Tone: ${params.tone}.` : "Tone: warm and professional."}
- No exclamation marks. No square-bracket placeholders of any kind.`;

  const userMsg = `Recipient: ${first}${params.contact.last_name ? " " + params.contact.last_name : ""}${params.contact.job_title ? `, ${params.contact.job_title}` : ""}${params.contact.company ? ` at ${params.contact.company}` : ""}.
What I want to say / offer: ${params.intent}`;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.8,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);

  const data = await res.json();
  const raw: string = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text?.trim() ?? "";

  // Guard against unresolved [bracket] placeholders (but allow the {{first_name}} merge tag)
  if (/\[[^\]]*\]/.test(raw)) throw new DraftPlaceholderError();

  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)$/m);
  const subject = subjectMatch ? subjectMatch[1].trim() : `A quick note${params.contact.company ? ` for ${params.contact.company}` : ""}`;
  const body = raw.replace(/^SUBJECT:\s*.+$/m, "").trim();
  const word_count = body.split(/\s+/).filter(Boolean).length;

  return { subject, body, word_count };
}
