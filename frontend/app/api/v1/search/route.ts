import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";
import { EmbeddingsError } from "@/lib/knowledge/embeddings";
import { searchKnowledge } from "@/lib/knowledge/ingest";
import { sourceHref } from "@/lib/knowledge/internal";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

/**
 * GET /api/v1/search?q=<query>&limit=<n>
 * Permission-aware semantic search over the org's knowledge platform
 * (docs, KB articles, uploads, connectors). Response shape is a stable
 * v1 contract: { results: [{ type, title, excerpt, similarity, portal_link }] }.
 * `type` values grew with the knowledge platform (file/connector/text/url
 * alongside the original document/knowledge_base).
 */
export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 5), 20);

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id, role").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ results: [] });

  try {
    const matches = await searchKnowledge(
      { orgId, userId, role: (profile?.role as string) ?? "member" },
      q,
      limit,
    );
    return NextResponse.json({
      results: matches.map(m => {
        const href = sourceHref(m.source_type, m.origin_id, m.url);
        return {
          type: m.source_type === "kb" ? "knowledge_base" : m.source_type === "doc" ? "document" : m.source_type,
          title: m.title,
          excerpt: m.content.slice(0, 500),
          similarity: Math.round(m.similarity * 1000) / 1000,
          portal_link: href.startsWith("/") ? `${BASE_URL}${href}` : href,
        };
      }),
    });
  } catch (e) {
    if (e instanceof EmbeddingsError) {
      return NextResponse.json({ error: "Semantic search is not available" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
