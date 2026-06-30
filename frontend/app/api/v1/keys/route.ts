import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateRawKey, hashKey } from "@/lib/api-key";

/** GET  — list all keys for the logged-in user (hashes never returned) */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, active, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ keys: data ?? [] });
}

/** POST — generate a new API key. Raw key returned ONCE, then discarded. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const raw  = generateRawKey();
  const hash = hashKey(raw);

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("api_keys")
    .insert({
      user_id:    user.id,
      name:       name.trim(),
      key_hash:   hash,
      key_prefix: raw.slice(0, 16) + "…",
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Raw key returned only once — user must copy it now
  return NextResponse.json({ ...data, raw_key: raw }, { status: 201 });
}

/** DELETE — revoke a key by id */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("api_keys").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
