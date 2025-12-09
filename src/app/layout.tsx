import { BottomNav } from "@/components/bottom-nav";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Caveat, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const caveat = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Planning Friend - Text it. Save it. Plan it.",
  description:
    "Your planning friend! Text links to save meals, events, and date ideas. Access your organized collection anytime.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${caveat.variable} font-sans antialiased min-h-screen bg-paper`}
      >
        {children}
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
