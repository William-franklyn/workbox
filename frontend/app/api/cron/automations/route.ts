import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Vercel cron: runs daily at 9am UTC — checks due-date automations for all orgs.
// Authorization: Vercel sets the CRON_SECRET header automatically on cron requests.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const svc = createServiceClient();
  const { data: orgs } = await svc.from("organizations").select("id");
  if (!orgs?.length) return NextResponse.json({ ran: 0, orgs: 0 });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let total = 0;

  for (const org of orgs) {
    try {
      const res = await fetch(`${base}/api/automations/run?org_id=${org.id}`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        total += data.ran ?? 0;
      }
    } catch { /* continue to next org */ }
  }

  return NextResponse.json({ ran: total, orgs: orgs.length });
}
