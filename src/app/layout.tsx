import { BottomNav } from "@/components/bottom-nav";
import { SWRProvider } from "@/lib/swr-config";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The fonts ship with the app (variable, latin, SIL OFL — licenses alongside
// in ./fonts) rather than coming from Google Fonts at build time. Fetching
// them during `next build` failed whenever Google was slow or unreachable from
// CI, which turned unrelated changes red.
const dmSans = localFont({
  src: "./fonts/dm-sans-latin-wght.woff2",
  variable: "--font-sans",
  weight: "100 1000",
  display: "swap",
});

const fraunces = localFont({
  src: "./fonts/fraunces-latin-wght.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
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

// viewport-fit=cover lets the page run to the bottom edge of the screen. Without
// it, iOS reports every env(safe-area-inset-*) as 0, so the bottom nav's
// home-indicator padding (and the drawers') did nothing, and the nav was
// positioned against a viewport that stopped short of the screen's edge.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased min-h-screen bg-background`}
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
