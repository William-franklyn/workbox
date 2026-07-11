import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { renderNotesPng, verifyImageToken } from "@/lib/notes/render";

/** GET /api/sticky-notes/image?t=<token> — public, token-authed PNG of a
 *  user's notes board. Rendered on demand; nothing stored. Meta/WhatsApp
 *  fetches this URL directly (no session), so access is via signed token. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const userId = verifyImageToken(token);
  if (!userId) return new Response("Invalid or expired link", { status: 403 });

  const svc = createServiceClient();
  const { data: notes } = await svc.from("sticky_notes")
    .select("content, color, x, y").eq("user_id", userId);

  const png = await renderNotesPng(notes ?? []);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
