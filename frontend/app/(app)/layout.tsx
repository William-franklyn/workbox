import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) redirect("/login");

    let fullName = "";
    let role = "member";
    let orgId = "";

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, organization_id")
        .eq("id", user.id)
        .maybeSingle();

      fullName = profile?.full_name ?? "";
      role = profile?.role ?? "member";
      orgId = profile?.organization_id ?? "";
    } catch {
      // profile fetch failed — continue with defaults
    }

    return (
      <AppShell
        userId={user.id}
        orgId={orgId}
        orgName="My Workspace"
        userRole={role}
        userName={fullName || user.email || ""}
        userEmail={user.email ?? ""}
      >
        {children}
      </AppShell>
    );
  } catch (err: any) {
    // If it's a redirect, re-throw it (Next.js redirects throw internally)
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    // Any other server error — send to login
    redirect("/login");
  }
}
