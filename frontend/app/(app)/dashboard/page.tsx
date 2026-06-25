import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/chat/new");

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: true });

  return (
    <DashboardClient
      orgId={profile.organization_id}
      members={members || []}
    />
  );
}
