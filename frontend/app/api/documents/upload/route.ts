import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractableType } from "@/lib/knowledge/extract";
import { runIngest } from "@/lib/knowledge/ingest";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServiceClient();
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const fileType = file.name.split(".").pop()?.toLowerCase() || "txt";
  const storagePath = `${profile.organization_id}/${Date.now()}-${file.name}`;
  const fileBytes = await file.arrayBuffer();

  // Upload to Supabase Storage
  const { error: storageError } = await sb.storage
    .from("documents")
    .upload(storagePath, fileBytes, { contentType: file.type });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // Create document record
  const { data: doc, error: docError } = await sb.from("documents").insert({
    organization_id: profile.organization_id,
    uploaded_by: user.id,
    name: file.name,
    file_type: fileType,
    storage_path: storagePath,
    status: "pending",
  }).select().single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Failed to create document record." }, { status: 500 });
  }

  // Ingest into the knowledge platform in the background (replaces the
  // retired FastAPI service), mirroring status back onto the documents row.
  if (extractableType(file.name, file.type)) {
    void (async () => {
      try {
        await sb.from("documents").update({ status: "processing" }).eq("id", doc.id);
        const { data: source } = await sb.from("knowledge_sources").upsert({
          org_id: profile.organization_id,
          created_by: user.id,
          type: "file",
          origin_id: `document:${doc.id}`,
          title: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
        }, { onConflict: "org_id,type,origin_id" }).select("id").single();
        const result = source ? await runIngest(source.id) : { ok: false as const, error: "source insert failed" };
        await sb.from("documents")
          .update({ status: result.ok ? "ready" : "error" })
          .eq("id", doc.id);
      } catch {
        await sb.from("documents").update({ status: "error" }).eq("id", doc.id).then(() => {}, () => {});
      }
    })();
  } else {
    await sb.from("documents").update({ status: "ready" }).eq("id", doc.id);
  }

  return NextResponse.json({ document: doc });
}
