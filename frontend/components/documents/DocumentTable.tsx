"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Doc {
  id: string;
  name: string;
  file_type: string;
  status: string;
  chunk_count: number | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700 animate-pulse",
  ready:      "bg-green-100 text-green-700",
  error:      "bg-red-100 text-red-700",
};

interface Props { orgId: string; refreshKey: number; }

export default function DocumentTable({ orgId, refreshKey }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("documents").select("id,name,file_type,status,chunk_count,created_at")
      .eq("organization_id", orgId).order("created_at", { ascending: false })
      .then(({ data }) => setDocs(data || []));

    // Live updates via Realtime
    const channel = supabase.channel("docs")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "documents" }, (payload) => {
        setDocs((prev) => prev.map((d) => d.id === payload.new.id ? { ...d, ...payload.new } as Doc : d));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, refreshKey]);

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document and all its data?")) return;
    const supabase = createClient();
    await supabase.from("documents").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  if (docs.length === 0) return (
    <p className="text-sm text-gray-400 text-center py-8">No documents yet. Upload one above.</p>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {["Name", "Type", "Chunks", "Status", "Uploaded", ""].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {docs.map((doc) => (
            <tr key={doc.id} className="bg-white hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{doc.name}</td>
              <td className="px-4 py-3 text-gray-500 uppercase text-xs">{doc.file_type}</td>
              <td className="px-4 py-3 text-gray-500">{doc.chunk_count ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[doc.status] || ""}`}>
                  {doc.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {new Date(doc.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => deleteDoc(doc.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
