import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/guard";
import { checkSeatAvailable } from "@/lib/billing/entitlements";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const profile = { organization_id: ctx.orgId };

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const seatError = await checkSeatAvailable(ctx.svc, ctx.orgId);
  if (seatError) return NextResponse.json({ error: seatError, code: "seat_limit" }, { status: 402 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async function addExistingUser(userId: string) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.organization_id === profile!.organization_id) {
      return NextResponse.json({ error: "This person is already in your workspace." }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ organization_id: profile!.organization_id, role: "member" })
      .eq("id", userId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ ok: true, existing: true });
  }

  // Check profiles table first (fast path)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, organization_id")
    .ilike("email", email.trim())
    .maybeSingle();

  if (existingProfile) return addExistingUser(existingProfile.id);

  // Try to generate invite link for new user
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: email.trim(),
    options: { data: { organization_id: profile.organization_id, role: "member" } },
  });

  if (error) {
    // User exists in auth but has no profile email — find them via auth users list
    if (error.message.toLowerCase().includes("already")) {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const found = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (found) return addExistingUser(found.id);
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, link: data.properties?.action_link });
}
