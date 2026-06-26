import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  // profiles may not exist yet — fail gracefully
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id")
    .eq("id", user.id)
    .maybeSingle()
    .catch(() => ({ data: null })) as { data: any };

  return (
    <AppShell
      userId={user.id}
      orgId={profile?.organization_id ?? ""}
      orgName="My Workspace"
      userRole={profile?.role ?? "member"}
      userName={profile?.full_name ?? user.email ?? ""}
      userEmail={user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
