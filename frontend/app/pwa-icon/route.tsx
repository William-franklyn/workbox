import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { markDataUri, MARK_ASPECT } from "@/lib/brand";

/**
 * Stable-URL PNG icons for the web app manifest (Android / desktop install).
 * `?maskable=1` shrinks the mark into the maskable safe zone so launchers can
 * crop it to any shape without clipping the glyph.
 */
export const runtime = "nodejs";

const SIZE = 512;

export async function GET(req: NextRequest) {
  const maskable = req.nextUrl.searchParams.get("maskable") === "1";
  const h = maskable ? 300 : 340;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={Math.round(h * MARK_ASPECT)} height={h} src={markDataUri("#0b0b12")} alt="" />
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
