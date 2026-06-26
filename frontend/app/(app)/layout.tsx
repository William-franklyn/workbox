import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConversationSidebar from "@/components/chat/ConversationSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: org } = profile?.organization_id
    ? await supabase.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle()
    : { data: null };

  return (
    <div className="flex h-screen bg-gray-50">
      <ConversationSidebar
        userId={user.id}
        orgId={profile?.organization_id}
        orgName={org?.name || ""}
        userRole={profile?.role || "member"}
        userName={profile?.full_name || user.email || ""}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
