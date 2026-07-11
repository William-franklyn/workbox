import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guard";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("id, full_name, role, organization_id, created_at, phone_number, phone_verified").eq("id", user.id).maybeSingle();

  if (!profile?.organization_id) {
    // Solo user — return just themselves so self-assignment works
    return NextResponse.json(profile ? [profile] : []);
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, phone_number, phone_verified")
    .eq("organization_id", profile.organization_id)
    .order("created_at");

  // Always ensure current user is in the list
  const members = data ?? [];
  if (!members.find((m) => m.id === user.id)) members.unshift(profile);

  return NextResponse.json(members);
}

/** PATCH { user_id, role } — change a member's role (admins only). */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { user_id, role } = await req.json();
  if (!user_id || !role) return NextResponse.json({ error: "user_id and role required" }, { status: 400 });
  if (!["admin", "member", "guest"].includes(role)) {
    return NextResponse.json({ error: "role must be admin, member, or guest" }, { status: 400 });
  }

  const { data: target } = await ctx.svc
    .from("profiles").select("id, role, organization_id").eq("id", user_id).maybeSingle();
  if (!target || target.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  // The owner role can't be granted or taken away here — transfer is a
  // deliberate, separate operation.
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 403 });
  }
  // Only the owner can promote to admin or demote admins.
  if ((role === "admin" || target.role === "admin") && ctx.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can manage admins" }, { status: 403 });
  }

  const { data, error } = await ctx.svc
    .from("profiles").update({ role }).eq("id", user_id)
    .select("id, full_name, role").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}
