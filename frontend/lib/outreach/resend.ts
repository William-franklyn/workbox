// Resend transactional email — the MVP sending provider for outreach.
// Env: RESEND_API_KEY, RESEND_FROM (e.g. "You <you@yourdomain.com>").
// A verified domain in Resend is required for real delivery.

const RESEND_API = "https://api.resend.com/emails";

export class SendNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set");
    this.name = "SendNotConfiguredError";
  }
}

export function sendingConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;
}

export interface SendResult { id: string | null; error?: string; }

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;        // plain text; newlines become <br>
  from?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = params.from || process.env.RESEND_FROM;
  if (!apiKey || !from) throw new SendNotConfiguredError();

  const html = params.body
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.body,
      html,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { id: null, error: `Resend ${res.status}: ${err.slice(0, 120)}` };
  }
  const data = await res.json();
  return { id: data.id ?? null };
}
