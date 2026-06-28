import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("organization_id, role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Only admins can invite members" }, { status: 403 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if this email already has an account
  const { data: existing } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("email", email.trim())
    .maybeSingle();

  if (existing) {
    if (existing.organization_id === profile.organization_id) {
      return NextResponse.json({ error: "This person is already in your workspace." }, { status: 400 });
    }
    // Existing user — add them to this workspace directly
    const { error: updateError } = await admin
      .from("profiles")
      .update({ organization_id: profile.organization_id, role: "member" })
      .eq("id", existing.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ ok: true, existing: true });
  }

  // New user — generate an invite link
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: email.trim(),
    options: { data: { organization_id: profile.organization_id, role: "member" } },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, link: data.properties?.action_link });
}
