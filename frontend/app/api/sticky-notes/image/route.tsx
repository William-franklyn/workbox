import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyImageToken, NOTE_COLORS, type Note } from "@/lib/notes/render";

/** GET /api/sticky-notes/image?t=<token> — public, token-authed PNG of a
 *  user's notes board, rendered on demand via next/og. Nothing is stored;
 *  Meta/WhatsApp fetches this URL directly (no session), hence the token. */
export const runtime = "nodejs";

const W = 900, H = 640, CARD_W = 190, CARD_H = 150;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const userId = verifyImageToken(token);
  if (!userId) return new Response("Invalid or expired link", { status: 403 });

  const svc = createServiceClient();
  const { data } = await svc.from("sticky_notes").select("content, color, x, y").eq("user_id", userId);
  const notes = (data ?? []) as Note[];

  const fontData = fs.readFileSync(path.join(process.cwd(), "lib/notes/font.ttf"));

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: "#faf7ef", position: "relative", display: "flex" }}>
        {notes.length === 0 && (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9a9a", fontSize: 22 }}>
            No sticky notes yet
          </div>
        )}
        {notes.map((n, i) => {
          const c = NOTE_COLORS[n.color] ?? NOTE_COLORS.yellow;
          const left = Math.max(8, Math.min(n.x, W - CARD_W - 8));
          const top = Math.max(8, Math.min(n.y, H - CARD_H - 8));
          return (
            <div key={i} style={{
              position: "absolute", left, top, width: CARD_W, height: CARD_H,
              background: c.bg, borderRadius: 12, display: "flex", flexDirection: "column",
              boxShadow: "0 3px 8px rgba(0,0,0,0.15)", overflow: "hidden",
            }}>
              <div style={{ height: 8, background: c.bar, opacity: 0.5, display: "flex" }} />
              <div style={{ padding: "12px 14px", color: c.text, fontSize: 17, lineHeight: 1.35, display: "flex" }}>
                {(n.content || "(empty)").slice(0, 140)}
              </div>
            </div>
          );
        })}
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "Roboto", data: fontData, style: "normal", weight: 400 }] },
  );
}
