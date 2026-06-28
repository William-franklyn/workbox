import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });

  const [folderRes, resourcesRes] = await Promise.all([
    supabase.from("folders").select("id, name, space_id").eq("id", folderId).maybeSingle(),
    supabase.from("folder_resources").select("*").eq("folder_id", folderId).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    folder: folderRes.data ?? null,
    resources: resourcesRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles")
    .select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const contentType = req.headers.get("content-type") ?? "";

  // ── File upload ──────────────────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const sb = createServiceClient();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const folderId = form.get("folderId") as string;
    if (!file || !folderId) return NextResponse.json({ error: "Missing file or folderId" }, { status: 400 });

    const storagePath = `folders/${folderId}/${Date.now()}-${file.name}`;
    const { error: storageErr } = await sb.storage
      .from("documents")
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type });
    if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "file";
    const { data, error } = await supabase.from("folder_resources").insert({
      id: crypto.randomUUID(),
      folder_id: folderId,
      organization_id: profile.organization_id,
      added_by: user.id,
      type: ext,
      name: file.name,
      storage_path: storagePath,
      file_type: ext,
      size: file.size,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  // ── Link resource ─────────────────────────────────────────────────────────
  const { folderId, type, name, url } = await req.json();
  if (!folderId || !url) return NextResponse.json({ error: "Missing folderId or url" }, { status: 400 });

  const { data, error } = await supabase.from("folder_resources").insert({
    id: crypto.randomUUID(),
    folder_id: folderId,
    organization_id: profile.organization_id,
    added_by: user.id,
    type: type ?? "link",
    name: name?.trim() || url,
    url,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, storagePath } = await req.json();

  if (storagePath) {
    const sb = createServiceClient();
    await sb.storage.from("documents").remove([storagePath]);
  }

  const { error } = await supabase.from("folder_resources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
