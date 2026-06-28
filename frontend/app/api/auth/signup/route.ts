import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[signup API] env check:", {
    url: url ? url.slice(0, 30) + "..." : "MISSING",
    key: key ? "present (" + key.slice(0, 10) + "...)" : "MISSING",
  });

  if (!url || !key) {
    throw new Error(`Missing env vars: ${!url ? "NEXT_PUBLIC_SUPABASE_URL " : ""}${!key ? "SUPABASE_SERVICE_ROLE_KEY" : ""}`);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, fullName, email, password } = body;

    console.log("[signup API] received:", { companyName, fullName, email, hasPassword: !!password });

    if (!companyName || !fullName || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const admin = getAdmin();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    console.log("[signup API] createUser:", {
      userId: authData?.user?.id,
      error: authError ? { message: authError.message, status: authError.status } : null,
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create user." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      role: "admin",
      organization_id: userId,
    });

    console.log("[signup API] profile upsert:", { error: profileError?.message ?? null });

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error("[signup API] exception:", err?.message ?? err);
    return NextResponse.json({ error: err?.message || "Signup failed." }, { status: 500 });
  }
}
