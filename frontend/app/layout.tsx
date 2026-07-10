import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PostHogProvider from "@/components/analytics/PostHogProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WorkBox — All-in-One Productivity",
  description: "Fast, beautiful, AI-powered productivity platform for teams and individuals",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark">
      <body className={`${inter.variable} h-full font-sans`}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
