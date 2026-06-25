"use client";
import { useState, useRef } from "react";

interface Props {
  onUploaded: () => void;
}

export default function UploadZone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed.");
    } else {
      onUploaded();
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        dragging ? "border-[#1a3c5e] bg-blue-50" : "border-gray-200 hover:border-[#2d6a9f] hover:bg-gray-50"
      }`}
    >
      <input
        ref={inputRef} type="file" className="hidden"
        accept=".pdf,.docx,.txt"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />
      <div className="text-3xl mb-3">📄</div>
      {uploading ? (
        <p className="text-sm text-gray-500 animate-pulse">Uploading and processing...</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">Drop a file here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Supports PDF, Word (.docx), and text files</p>
        </>
      )}
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
