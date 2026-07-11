import "server-only";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/** Sticky-notes board → PNG, rendered on demand (nothing stored). */

interface Note { content: string; color: string; x: number; y: number; }

const COLORS: Record<string, { bg: string; text: string }> = {
  yellow: { bg: "#fef9c3", text: "#713f12" }, pink: { bg: "#fce7f3", text: "#831843" },
  blue: { bg: "#dbeafe", text: "#1e3a8a" }, green: { bg: "#dcfce7", text: "#14532d" },
  purple: { bg: "#ede9fe", text: "#4c1d95" }, orange: { bg: "#ffedd5", text: "#7c2d12" },
};

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function wrap(text: string, max = 24): string[] {
  const words = (text || "").split(/\s+/);
  const lines: string[] = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

export function notesToSvg(notes: Note[], width = 900, height = 640): string {
  const W = 176, H = 150;
  const cards = notes.map(n => {
    const c = COLORS[n.color] ?? COLORS.yellow;
    const x = Math.max(0, Math.min(n.x, width - W)), y = Math.max(0, Math.min(n.y, height - H));
    const lines = wrap(n.content || "(empty)");
    const text = lines.map((l, i) => `<text x="${x + 14}" y="${y + 34 + i * 20}" font-family="sans-serif" font-size="15" fill="${c.text}">${esc(l)}</text>`).join("");
    return `<g><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="10" fill="${c.bg}" stroke="rgba(0,0,0,0.08)"/><rect x="${x}" y="${y}" width="${W}" height="8" rx="4" fill="${c.text}" opacity="0.25"/>${text}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#faf7ef"/>${cards || `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#9a9a9a">No sticky notes yet</text>`}</svg>`;
}

let wasmReady: Promise<void> | null = null;
async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const { initWasm } = await import("@resvg/resvg-wasm");
      const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
      await initWasm(fs.readFileSync(wasmPath));
    })();
  }
  return wasmReady;
}

let fontBuffer: Buffer | null = null;
function loadFont(): Buffer {
  if (!fontBuffer) fontBuffer = fs.readFileSync(path.join(process.cwd(), "lib/notes/font.ttf"));
  return fontBuffer;
}

export async function renderNotesPng(notes: Note[]): Promise<Buffer> {
  await ensureWasm();
  const { Resvg } = await import("@resvg/resvg-wasm");
  const svg = notesToSvg(notes);
  // resvg-wasm has no access to system fonts — supply an embedded one, or text
  // renders blank.
  const resvg = new Resvg(svg, {
    font: { fontBuffers: [new Uint8Array(loadFont())], defaultFontFamily: "Roboto", loadSystemFonts: false },
  });
  return Buffer.from(resvg.render().asPng());
}

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
