import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Public — no auth needed. Returns form definition for rendering the public form.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = createServiceClient();

  const { data, error } = await svc.from("forms")
    .select("id, name, description, fields, active")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (!data.active) return NextResponse.json({ error: "Form is not active" }, { status: 410 });

  return NextResponse.json(data);
}
