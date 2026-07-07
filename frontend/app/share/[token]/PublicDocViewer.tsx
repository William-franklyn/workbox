"use client";
import { useState, useEffect } from "react";

interface Doc {
  id: string; name: string; content?: string; description?: string;
  author_name?: string; created_at: string; share_access: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3 style='font-size:1.1rem;font-weight:600;margin:1.2em 0 .4em'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 style='font-size:1.3rem;font-weight:700;margin:1.5em 0 .5em'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 style='font-size:1.7rem;font-weight:800;margin:0 0 .6em'>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:.9em'>$1</code>")
    .replace(/^- \[x\] (.+)$/gm, "<div style='display:flex;gap:8px;align-items:flex-start;margin:.25em 0'>✅ <span>$1</span></div>")
    .replace(/^- \[ \] (.+)$/gm, "<div style='display:flex;gap:8px;align-items:flex-start;margin:.25em 0'>☐ <span>$1</span></div>")
    .replace(/^- (.+)$/gm, "<div style='display:flex;gap:8px;margin:.2em 0'>· <span>$1</span></div>")
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      if (/^[-| ]+$/.test(row)) return "";
      const cells = row.split("|").map((c: string) => `<td style='padding:6px 12px;border-bottom:1px solid #333'>${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>(\n|$))+/g, m => `<table style='border-collapse:collapse;width:100%;margin:1em 0'>${m}</table>`)
    .replace(/\n\n+/g, "</p><p style='margin:.6em 0'>")
    .replace(/^(?!<[htdpcb])(.+)$/gm, "<p style='margin:.4em 0'>$1</p>");
}

const GATE_DELAY = 3000;
const COUNTDOWN_FROM = 15;

export default function PublicDocViewer({ doc }: { doc: Doc }) {
  const [gateVisible, setGateVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGateVisible(true), GATE_DELAY);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!gateVisible || locked) return;
    if (countdown <= 0) { setLocked(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gateVisible, countdown, locked]);

  function snooze() {
    if (locked) return;
    setGateVisible(false);
    setCountdown(COUNTDOWN_FROM);
    setTimeout(() => setGateVisible(true), 90_000);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8e8e8", fontFamily: "system-ui,sans-serif" }}>

      {/* Top bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(13,13,13,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#000" }}>W</div>
          <span style={{ fontSize: 13, color: "#888" }}>Viewing via WorkBox</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href={`${appUrl}/login`} style={{ fontSize: 13, color: "#ccc", textDecoration: "none", padding: "7px 16px", border: "1px solid #333", borderRadius: 8 }}>Sign in</a>
          <a href={`${appUrl}/signup`} style={{ fontSize: 13, fontWeight: 600, color: "#000", textDecoration: "none", padding: "7px 16px", background: "#fff", borderRadius: 8 }}>Sign up free</a>
        </div>
      </header>

      {/* Document content */}
      <div style={{ filter: locked ? "blur(5px)" : "none", pointerEvents: locked ? "none" : "auto", userSelect: locked ? "none" : "auto", transition: "filter 0.4s" }}>
        <article style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 8, color: "#fff" }}>{doc.name}</h1>
          {doc.description && <p style={{ color: "#777", fontSize: 14, marginBottom: 8 }}>{doc.description}</p>}
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#555", marginBottom: 40, paddingBottom: 24, borderBottom: "1px solid #222" }}>
            {doc.author_name && <span>by {doc.author_name}</span>}
            <span>{new Date(doc.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            <span style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: 1, color: doc.share_access === "edit" ? "#6ee7b7" : "#888" }}>
              {doc.share_access === "edit" ? "Edit access" : "View only"}
            </span>
          </div>
          {doc.content ? (
            <div
              style={{ lineHeight: 1.75, fontSize: 15, color: "#d4d4d4" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
            />
          ) : (
            <p style={{ color: "#555", fontStyle: "italic" }}>This document has no content yet.</p>
          )}
        </article>
      </div>

      {/* Gate modal */}
      {gateVisible && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: locked ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, transition: "background 0.4s",
        }}>
          <div style={{
            background: "#161616", border: "1px solid #2a2a2a", borderRadius: 20,
            padding: "40px 36px", maxWidth: 420, width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          }}>
            <div style={{ width: 56, height: 56, background: "#fff", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#000", margin: "0 auto 20px" }}>W</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: 8 }}>
              {locked ? "Create an account to keep reading" : "Enjoying this document?"}
            </h2>
            <p style={{ color: "#888", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              {locked
                ? "Sign up for WorkBox to access documents, collaborate with your team, and manage all your work in one place — free."
                : "Sign up free to save, collaborate on, and create your own documents on WorkBox."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={`${appUrl}/signup`} style={{ display: "block", padding: "13px", background: "#fff", color: "#000", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Create free account
              </a>
              <a href={`${appUrl}/login`} style={{ display: "block", padding: "13px", border: "1px solid #333", color: "#ccc", borderRadius: 12, fontWeight: 500, fontSize: 14, textDecoration: "none" }}>
                Sign in
              </a>
              {!locked && (
                <button onClick={snooze} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", padding: "8px", borderRadius: 8 }}>
                  Continue reading ({countdown}s)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
