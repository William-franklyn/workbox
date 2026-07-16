/**
 * Structure-aware chunking for the knowledge platform.
 *
 * Splits on markdown headings and blank lines, packs paragraphs greedily
 * into ~CHUNK_SIZE-char chunks, and carries a tail overlap between chunks
 * so answers spanning a boundary still retrieve. Replaces the flat
 * char-window chunkers in lib/embeddings.ts and backend/services/chunker.py.
 */

const CHUNK_SIZE = 1600;   // chars — ~400 tokens
const CHUNK_OVERLAP = 200;
const MIN_CHUNK = 200;     // merge trailing fragments smaller than this

export interface Chunk {
  content: string;
  index: number;
}

/** Split oversized paragraphs at sentence boundaries, hard-wrapping as a last resort. */
function splitLongBlock(block: string): string[] {
  if (block.length <= CHUNK_SIZE) return [block];
  const sentences = block.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && buf.length + s.length + 1 > CHUNK_SIZE) {
      parts.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
    // A single "sentence" longer than the window (tables, minified text): hard-wrap.
    while (buf.length > CHUNK_SIZE) {
      parts.push(buf.slice(0, CHUNK_SIZE));
      buf = buf.slice(CHUNK_SIZE - CHUNK_OVERLAP);
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export function chunkText(text: string, title = ""): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];

  // Blocks: heading lines start a new block; blank lines separate blocks.
  const blocks = clean
    .split(/\n(?=#{1,6}\s)|\n{2,}/)
    .map((b) => b.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .flatMap(splitLongBlock);

  const chunks: string[] = [];
  let buf = "";
  for (const block of blocks) {
    if (buf && buf.length + block.length + 2 > CHUNK_SIZE) {
      chunks.push(buf);
      // Overlap: seed the next chunk with the tail of the previous one.
      const tail = buf.slice(-CHUNK_OVERLAP);
      buf = `${tail.slice(tail.indexOf(" ") + 1)}\n${block}`;
    } else {
      buf = buf ? `${buf}\n${block}` : block;
    }
  }
  if (buf) {
    if (chunks.length && buf.length < MIN_CHUNK) {
      chunks[chunks.length - 1] += `\n${buf}`;
    } else {
      chunks.push(buf);
    }
  }

  // Prefix the title so every chunk carries its document context into the embedding.
  const prefix = title.trim() ? `${title.trim()}\n` : "";
  return chunks.map((content, index) => ({ content: `${prefix}${content}`, index }));
}
