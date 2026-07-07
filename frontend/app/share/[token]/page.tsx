import { createServiceClient } from "@/lib/supabase/server";
import PublicDocViewer from "./PublicDocViewer";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = createServiceClient();

  const { data } = await svc
    .from("org_documents")
    .select("id, name, content, description, author_name, created_at, updated_at, share_access")
    .eq("share_token", token)
    .neq("share_access", "none")
    .maybeSingle();

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Document not found</p>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
            This link may have expired or sharing has been disabled by the owner.
          </p>
          <a href="/login" style={{ display: "inline-block", background: "#fff", color: "#000", padding: "10px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Sign in to WorkBox
          </a>
        </div>
      </div>
    );
  }

  return <PublicDocViewer doc={data as { id: string; name: string; content?: string; description?: string; author_name?: string; created_at: string; share_access: string }} />;
}
