import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PostHogProvider from "@/components/analytics/PostHogProvider";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://workbox-blue.vercel.app"),
  title: "WorkBox — All-in-One Productivity",
  description: "Fast, beautiful, AI-powered productivity platform for teams and individuals",
  manifest: "/manifest.json",
  applicationName: "WorkBox",
  appleWebApp: {
    capable: true,
    title: "WorkBox",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before hydration so the chosen theme never flashes.
const themeInit = `(function(){try{var t=localStorage.getItem("wb_theme")||"light";var d=document.documentElement;d.setAttribute("data-theme",t);d.classList.toggle("dark",t==="dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Older iOS launches full-screen from the home screen off this tag
            (newer iOS uses the manifest's display:standalone). */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${inter.variable} h-full font-sans`}>
        <ServiceWorkerRegister />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
