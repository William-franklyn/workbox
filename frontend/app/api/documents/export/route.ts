import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const htmlDocxModule = require("html-to-docx");
// Next's CJS interop can wrap the export as { default: fn }.
const HTMLtoDOCX: (html: string, headerHTML: string | null, opts?: unknown) => Promise<Buffer> =
  htmlDocxModule.default ?? htmlDocxModule;

/**
 * POST /api/documents/export  { id }
 * Returns the document as a real Word .docx. Org-scoped via the same auth as
 * the documents API (RLS on the docs read).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, html: liveHtml, name: liveName } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const { data: doc } = await svc.from("org_documents")
    .select("name, content, org_id").eq("id", id).maybeSingle();
  if (!doc || (doc.org_id && doc.org_id !== profile?.organization_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Prefer the live editor content (unsaved edits) when provided.
  const title = (liveName as string) || (doc.name as string) || "Document";
  const bodyHtml = (liveHtml as string) || (doc.content as string) || "<p></p>";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${bodyHtml}</body></html>`;

  let buffer: Buffer;
  try {
    buffer = await HTMLtoDOCX(html, null, { table: { row: { cantSplit: true } } });
  } catch (e) {
    console.error("[docx export]", e);
    return NextResponse.json({ error: "Conversion failed: " + (e instanceof Error ? e.message : String(e)).slice(0, 200) }, { status: 500 });
  }

  const safeName = title.replace(/[^\w.\- ]+/g, "_").slice(0, 80);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}.docx"`,
    },
  });
}
