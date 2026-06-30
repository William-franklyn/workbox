import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

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
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: doc, error } = await supabase
    .from("docs")
    .select("id, title, blocks, created_at, updated_at")
    .eq("id", id)
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
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { title, content } = await req.json();
  const supabase = createServiceClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title) patch.title = title;
  if (content) {
    patch.blocks = content.split("\n\n").filter(Boolean).map((para: string) => ({
      id: crypto.randomUUID(),
      type: "paragraph",
      content: [{ type: "text", text: para }],
    }));
  }

  const { data, error } = await supabase
    .from("docs").update(patch).eq("id", id).select("id, title, updated_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ doc: { ...data, portal_link: `${BASE_URL}/docs/${id}` } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();
  await supabase.from("docs").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
