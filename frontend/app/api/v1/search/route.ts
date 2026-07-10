import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";
import { searchChunks } from "@/lib/embeddings";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

/**
 * GET /api/v1/search?q=<query>&limit=<n>
 * Semantic search across the organization's documents and knowledge base.
 */
export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 5), 20);

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ results: [] });

  const matches = await searchChunks(q, orgId, limit);
  if (matches === null) {
    return NextResponse.json({ error: "Semantic search is not available" }, { status: 503 });
  }

  return NextResponse.json({
    results: matches.map(m => ({
      type: m.source_type === "kb" ? "knowledge_base" : "document",
      title: m.title,
      excerpt: m.content.slice(0, 500),
      similarity: Math.round(m.similarity * 1000) / 1000,
      portal_link: m.source_type === "kb" ? `${BASE_URL}/knowledge` : `${BASE_URL}/docs/${m.source_id}`,
    })),
  });
}
