import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";
import { EmbeddingsError, embeddingsConfigured } from "@/lib/knowledge/embeddings";
import { searchKnowledge } from "@/lib/knowledge/ingest";

/** Permission-aware semantic search over the knowledge platform. */
export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  const k = Math.min(Number(req.nextUrl.searchParams.get("k")) || 8, 20);

  if (!embeddingsConfigured()) {
    return NextResponse.json(
      { error: "Embeddings not configured — set VOYAGE_API_KEY or OPENAI_API_KEY" },
      { status: 503 },
    );
  }

  try {
    const results = await searchKnowledge(
      { orgId: ctx.orgId, userId: ctx.userId, role: ctx.role },
      q,
      k,
    );
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: e instanceof EmbeddingsError ? 502 : 500 });
  }
}
