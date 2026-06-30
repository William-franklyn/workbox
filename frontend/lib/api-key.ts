import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export function generateRawKey(): string {
  return `wbx_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Validates Bearer token from Authorization header. Returns user_id or null. */
export async function validateApiKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer wbx_")) return null;
  const raw = authHeader.slice(7);
  const hash = hashKey(raw);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("api_keys")
    .select("user_id, active")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!data?.active) return null;

  // Fire-and-forget last_used update
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", hash)
    .then(() => {});

  return data.user_id as string;
}
