"use client";
import { useState } from "react";
import UploadZone from "@/components/documents/UploadZone";
import DocumentTable from "@/components/documents/DocumentTable";

interface Member { id: string; full_name: string; role: string; created_at: string; }

interface Props { orgId: string; members: Member[]; }

export default function DashboardClient({ orgId, members }: Props) {
  const [tab, setTab] = useState<"documents" | "members">("documents");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-8">
          {(["documents", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "documents" && (
          <div className="space-y-6">
            <UploadZone onUploaded={() => setRefreshKey((k) => k + 1)} />
            <DocumentTable orgId={orgId} refreshKey={refreshKey} />
          </div>
        )}

        {tab === "members" && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Name", "Role", "Joined"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((m) => (
                  <tr key={m.id} className="bg-white">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.full_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        m.role === "admin" ? "bg-[#1a3c5e] text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
