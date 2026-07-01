import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100);
  const entity_type = params.get("entity_type");
  const entity_id = params.get("entity_id");
  const offset = parseInt(params.get("offset") ?? "0");

  const service = createServiceClient();

  try {
    let query = service
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id) query = query.eq("entity_id", entity_id);

    const { data: logs, error } = await query;

    if (error) {
      // Table likely doesn't exist yet
      return NextResponse.json({ logs: [] });
    }

    if (!logs || logs.length === 0) return NextResponse.json({ logs: [] });

    // Fetch profile names for user_ids
    const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))];
    let profileMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = p.full_name ?? "Unknown";
        }
      }
    }

    const enriched = logs.map((l) => ({
      id: l.id,
      user_id: l.user_id,
      user_name: l.user_id ? (profileMap[l.user_id] ?? "Unknown") : "System",
      entity_type: l.entity_type,
      entity_id: l.entity_id,
      entity_name: l.entity_name,
      action: l.action,
      old_value: l.old_value,
      new_value: l.new_value,
      created_at: l.created_at,
    }));

    return NextResponse.json({ logs: enriched });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { entity_type, entity_id, entity_name, action, old_value, new_value } = body;

  if (!entity_type || !entity_id || !action) {
    return NextResponse.json({ error: "entity_type, entity_id, and action are required" }, { status: 400 });
  }

  // Get org_id from profile
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const { data, error } = await service
      .from("activity_log")
      .insert({
        user_id: user.id,
        org_id: profile?.organization_id ?? null,
        entity_type,
        entity_id,
        entity_name: entity_name ?? null,
        action,
        old_value: old_value ?? null,
        new_value: new_value ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}
