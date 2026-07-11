import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signImageToken } from "@/lib/notes/render";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

/** POST — returns a short-lived public URL to a PNG of the caller's notes. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = signImageToken(user.id);
  return NextResponse.json({ url: `${BASE_URL}/api/sticky-notes/image?t=${token}` });
}
