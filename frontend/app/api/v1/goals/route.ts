import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, description, due_date, created_at")
    .eq("org_id", orgId ?? "")
    .order("created_at", { ascending: false });

  const goalIds = (goals ?? []).map(g => g.id);
  const { data: keyResults } = goalIds.length
    ? await supabase.from("key_results").select("*").in("goal_id", goalIds)
    : { data: [] };

  const result = (goals ?? []).map(g => {
    const krs = (keyResults ?? []).filter(kr => kr.goal_id === g.id);
    const progress = krs.length
      ? Math.round(krs.reduce((sum, kr) => sum + (kr.current_value / kr.target_value) * 100, 0) / krs.length)
      : 0;
    return { ...g, key_results: krs, progress_pct: progress };
  });

  return NextResponse.json({ goals: result });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, due_date, key_results = [] } = body;
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const goalId = crypto.randomUUID();
  const { data: goal, error } = await supabase
    .from("goals")
    .insert({ id: goalId, title, description: description ?? null, due_date: due_date ?? null,
      org_id: profile?.organization_id, created_by: userId })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let krs: unknown[] = [];
  if (key_results.length) {
    const rows = key_results.map((kr: { title: string; target_value?: number; unit?: string }) => ({
      id: crypto.randomUUID(), goal_id: goalId,
      title: kr.title, target_value: kr.target_value ?? 100,
      current_value: 0, unit: kr.unit ?? "%",
    }));
    const { data } = await supabase.from("key_results").insert(rows).select();
    krs = data ?? [];
  }

  return NextResponse.json({ goal: { ...goal, key_results: krs } }, { status: 201 });
}
