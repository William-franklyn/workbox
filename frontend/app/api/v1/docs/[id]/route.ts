import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

function blocksToText(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks.map(block => {
    const b = block as Record<string, unknown>;
    if (b.type === "table") {
      const headers = (b.headers as string[] ?? []).join(" | ");
      const rows = (b.rows as string[][] ?? []).map(r => r.join(" | ")).join("\n");
      return `${headers}\n${rows}`;
    }
    const content = b.content as Array<{ text?: string }> ?? [];
    return content.map(c => c.text ?? "").join("");
  }).filter(Boolean).join("\n\n");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const { data: doc, error } = await ctx.svc
    .from("docs")
    .select("id, title, blocks, created_at, updated_at")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const portalLink = `${BASE_URL}/docs/${id}`;
  const textContent = blocksToText(doc.blocks ?? []);

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    content: textContent,
    portal_link: portalLink,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { title, content } = await req.json();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title) patch.title = title;
  if (content) {
    patch.blocks = content.split("\n\n").filter(Boolean).map((para: string) => ({
      id: crypto.randomUUID(),
      type: "paragraph",
      content: [{ type: "text", text: para }],
    }));
  }

  const { data, error } = await ctx.svc
    .from("docs").update(patch).eq("id", id).eq("org_id", ctx.orgId)
    .select("id, title, updated_at").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json({ doc: { ...data, portal_link: `${BASE_URL}/docs/${id}` } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await ctx.svc.from("docs").delete().eq("id", id).eq("org_id", ctx.orgId);
  return NextResponse.json({ ok: true });
}
