import { ImageResponse } from "next/og";
import { markDataUri, MARK_ASPECT } from "@/lib/brand";

// iOS home-screen icon: the black WorkBox mark on a white tile. Opaque and
// full-bleed (iOS renders transparency as black and applies its own mask).
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const h = 116;
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
    { ...size },
  );
}
