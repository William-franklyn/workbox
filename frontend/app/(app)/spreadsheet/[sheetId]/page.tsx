"use client";
import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Univer touches window/document at import time — client-only.
const UniverSheet = dynamic(() => import("@/components/sheets/UniverSheet"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
    </div>
  ),
});

interface Sheet {
  id: string;
  name: string;
  col_headers: string[];
  row_data: string[][];
  workbook: Record<string, unknown> | null;
}

export default function SpreadsheetPage({ params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = use(params);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/spreadsheets?id=${sheetId}`)
      .then(r => r.json())
      .then((d: Sheet) => setSheet(d?.id ? d : null))
      .finally(() => setLoading(false));
  }, [sheetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-secondary)" }}>
        Spreadsheet not found.
      </div>
    );
  }

  return <UniverSheet sheet={sheet} />;
}
