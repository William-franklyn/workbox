import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import IntegrationsClient from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/chat/new");

  return <IntegrationsClient />;
}
