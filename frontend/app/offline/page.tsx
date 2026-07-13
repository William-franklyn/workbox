import { markDataUri, MARK_ASPECT } from "@/lib/brand";

export const metadata = { title: "Offline — WorkBox" };

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #8b5cf6, #6d28d9)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markDataUri("#ffffff")} width={Math.round(34 * MARK_ASPECT)} height={34} alt="WorkBox" />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>You&apos;re offline</h1>
      <p style={{ maxWidth: 320, fontSize: 14, color: "var(--text-secondary)" }}>
        WorkBox needs a connection for this page. Reconnect and try again — anything you were viewing will be here waiting.
      </p>
    </div>
  );
}
