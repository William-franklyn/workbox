/**
 * One-time backfill: embed all existing docs + knowledge base articles into
 * doc_chunks. Safe to re-run (rebuilds per source). Requires migration 021.
 *
 *   node scripts/backfill-embeddings.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim();

const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const HF_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";

const CHUNK_SIZE = 1200, OVERLAP = 150;

function chunkText(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const out = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const dot = clean.lastIndexOf(". ", end);
      if (dot > start + CHUNK_SIZE * 0.5) end = dot + 1;
    }
    out.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - OVERLAP;
  }
  return out.filter(Boolean);
}

function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((b) =>
    (Array.isArray(b?.content) ? b.content.map((c) => c?.text ?? "").join("") : "")
  ).join("\n");
}

async function embed(texts) {
  const res = await fetch(HF_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${get("HUGGINGFACE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: texts }),
  });
  if (!res.ok) throw new Error("HF " + res.status + ": " + (await res.text()).slice(0, 120));
  return res.json();
}

async function index(sourceType, sourceId, orgId, title, text) {
  await admin.from("doc_chunks").delete().eq("source_type", sourceType).eq("source_id", sourceId);
  const chunks = chunkText(`${title}\n${text}`);
  if (!chunks.length) return 0;
  const vectors = await embed(chunks);
  await admin.from("doc_chunks").insert(chunks.map((content, i) => ({
    org_id: orgId, source_type: sourceType, source_id: sourceId,
    title, chunk_index: i, content, embedding: vectors[i],
  })));
  return chunks.length;
}

const { data: docs } = await admin.from("docs").select("id, title, blocks, org_id").not("title", "like", "__sheet__%");
for (const d of docs ?? []) {
  const n = await index("doc", d.id, d.org_id, d.title, blocksToText(d.blocks));
  console.log(`doc  "${d.title}" → ${n} chunks`);
}

const { data: arts } = await admin.from("kb_articles").select("id, title, summary, content, org_id");
for (const a of arts ?? []) {
  const n = await index("kb", a.id, a.org_id, a.title, `${a.summary ?? ""}\n${a.content ?? ""}`);
  console.log(`kb   "${a.title}" → ${n} chunks`);
}

console.log("backfill complete");
