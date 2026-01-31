import { BottomNav } from "@/components/bottom-nav";
import { SWRProvider } from "@/lib/swr-config";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Planning Friend - Save it. Plan it. Do it.",
  description:
    "Your planning companion. Text links to save meals, events, and date ideas. Access your organized collection anytime.",
  keywords: [
    "planning",
    "recipes",
    "meal planning",
    "date ideas",
    "events",
    "collection",
    "tiktok downloader",
    "tiktok",
    "tiktok planner",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Planning Friend",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <SWRProvider>
          {children}
          <BottomNav />
        </SWRProvider>
        <Analytics />
      </body>
    </html>
  );
}
