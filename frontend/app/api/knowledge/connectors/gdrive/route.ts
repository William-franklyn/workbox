import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";
import { embeddingsConfigured } from "@/lib/knowledge/embeddings";
import { driveConnected, syncDrive } from "@/lib/knowledge/connectors/gdrive";

export const maxDuration = 300; // downloads + embeds up to 40 files inline

/** Connector status for the current user. */
export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const connected = await driveConnected(ctx.userId);
  const { count } = await ctx.svc.from("knowledge_sources")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.orgId).eq("type", "connector").like("origin_id", "gdrive:%");

  return NextResponse.json({ connected, synced_sources: count ?? 0 });
}

/** Sync the caller's Google Drive into the org knowledge base. */
export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!embeddingsConfigured()) {
    return NextResponse.json(
      { error: "Embeddings not configured — set VOYAGE_API_KEY or OPENAI_API_KEY" },
      { status: 503 },
    );
  }

  try {
    const result = await syncDrive(ctx.orgId, ctx.userId);
    return NextResponse.json({ ...result, errors: result.errors.slice(0, 10) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive sync failed";
    const notConnected = message.includes("not connected");
    return NextResponse.json({ error: message }, { status: notConnected ? 409 : 502 });
  }
}
