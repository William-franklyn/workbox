import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { companyName, fullName, email, password } = await req.json();

  if (!companyName || !fullName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const sb = createServiceClient();

  // 1. Create auth user
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Failed to create user." }, { status: 400 });
  }

  const userId = authData.user.id;

  // 2. Create organization
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const { data: org, error: orgError } = await sb
    .from("organizations")
    .insert({ name: companyName, slug: `${slug}-${Date.now()}` })
    .select()
    .single();

  if (orgError || !org) {
    await sb.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create organization." }, { status: 500 });
  }

  // 3. Create profile (admin role)
  const { error: profileError } = await sb.from("profiles").insert({
    id: userId,
    organization_id: org.id,
    full_name: fullName,
    role: "admin",
  });

  if (profileError) {
    await sb.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create profile." }, { status: 500 });
  }

  // 4. Sign in the user and return session via cookie
  const userSb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  await userSb.auth.signInWithPassword({ email, password });

  return NextResponse.json({ success: true });
}
