import "server-only";
import crypto from "crypto";

/** Sticky-notes board image helpers. Rendering happens in the image route via
 *  next/og (Vercel-native, builds cleanly, no wasm). Nothing is stored. */

export interface Note { content: string; color: string; x: number; y: number; }

export const NOTE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  yellow: { bg: "#fef9c3", text: "#713f12", bar: "#eab308" },
  pink:   { bg: "#fce7f3", text: "#831843", bar: "#ec4899" },
  blue:   { bg: "#dbeafe", text: "#1e3a8a", bar: "#3b82f6" },
  green:  { bg: "#dcfce7", text: "#14532d", bar: "#22c55e" },
  purple: { bg: "#ede9fe", text: "#4c1d95", bar: "#8b5cf6" },
  orange: { bg: "#ffedd5", text: "#7c2d12", bar: "#f97316" },
};

// --- Stateless signed token for public (WhatsApp-fetchable) image access ---
const SECRET = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret";

export function signImageToken(userId: string, ttlSec = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyImageToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, exp, sig] = decoded.split(".");
    if (!userId || !exp || !sig) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
    const expected = crypto.createHmac("sha256", SECRET()).update(`${userId}.${exp}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return userId;
  } catch { return null; }
}
