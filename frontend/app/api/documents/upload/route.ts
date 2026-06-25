import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

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

  // Trigger FastAPI ingestion in background
  const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";
  fetch(`${backendUrl}/api/v1/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: doc.id,
      organization_id: profile.organization_id,
      storage_path: storagePath,
      file_type: fileType,
    }),
  }).catch(() => {}); // fire and forget

  return NextResponse.json({ document: doc });
}
