import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { companyName, fullName, email, password } = await req.json();

    if (!companyName || !fullName || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const sb = createServiceClient();

    // Create auth user
    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Failed to create user." }, { status: 400 });
    }

    const userId = authData.user.id;

    // Upsert profile — org_id is the user's own ID (they're the admin of their workspace)
    await sb.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      role: "admin",
      organization_id: userId,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Signup failed." }, { status: 500 });
  }
}
