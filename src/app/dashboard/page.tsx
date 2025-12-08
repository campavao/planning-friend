"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/category-tabs";
import type { Content } from "@/lib/supabase";

interface SessionUser {
  id: string;
  phoneNumber: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTip, setShowTip] = useState(true);
  const router = useRouter();

  // Check if tip was dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem("tipDismissed");
    if (dismissed) setShowTip(false);
  }, []);

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("tipDismissed", "true");
  };

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch("/api/content");
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/");
          return;
        }
        throw new Error(data.error || "Failed to fetch content");
      }

      setContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    }
  }, [router]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (!data.authenticated) {
          router.push("/");
          return;
        }

        setUser(data.user);
        await fetchContent();
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router, fetchContent]);

  // Poll for updates when there are processing items
  useEffect(() => {
    const hasProcessing = content.some((c) => c.status === "processing");

    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchContent();
    }, 3000);

    return () => clearInterval(interval);
  }, [content, fetchContent]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchContent();
    setLoading(false);
  };

  // Count stats (only completed items)
  const completedContent = content.filter((c) => c.status === "completed");
  const processingCount = content.filter(
    (c) => c.status === "processing"
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-shimmer w-16 h-16 rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your saves...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-20 md:pb-8">
      {/* Header - Mobile Optimized */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-2xl">📱</span>
              <div>
                <h1 className="font-semibold text-base md:text-lg">
                  TikTok Helper
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {user?.phoneNumber}
                </p>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/dashboard/planner">
                <Button variant="default" size="sm">
                  📅 Plan Week
                </Button>
              </Link>
              <Link href="/dashboard/gifts">
                <Button variant="outline" size="sm">
                  🎁 Gifts
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                🔄 Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>

            {/* Mobile Actions - simplified since we have bottom nav */}
            <div className="flex md:hidden items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={handleRefresh}
                disabled={loading}
              >
                🔄
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={handleLogout}
              >
                👋
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-8">
        {/* Processing Banner */}
        {processingCount > 0 && (
          <div className="glass rounded-2xl p-4 mb-6 border-primary/30 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="font-medium">
                  Processing {processingCount} item
                  {processingCount > 1 ? "s" : ""}...
                </p>
                <p className="text-sm text-muted-foreground">
                  Your TikTok{processingCount > 1 ? "s are" : " is"} being
                  analyzed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Banner */}
        <div className="glass rounded-2xl p-4 md:p-6 mb-6 md:mb-8 animate-fade-in-up opacity-0">
          <div className="grid grid-cols-5 gap-1 md:flex md:flex-wrap md:gap-6 md:justify-start">
            <div className="text-center">
              <p className="text-xl md:text-3xl font-bold text-primary">
                {completedContent.length}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Saves
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-3xl font-bold text-meal">
                {completedContent.filter((c) => c.category === "meal").length}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Meals
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-3xl font-bold text-event">
                {completedContent.filter((c) => c.category === "event").length}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Events
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-3xl font-bold text-date">
                {
                  completedContent.filter((c) => c.category === "date_idea")
                    .length
                }
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Dates
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-3xl font-bold text-gift">
                {
                  completedContent.filter((c) => c.category === "gift_idea")
                    .length
                }
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Gifts
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </div>
        ) : (
          <div className="animate-fade-in-up opacity-0 stagger-2">
            <CategoryTabs content={content} />
          </div>
        )}
      </div>

      {/* Dismissible Quick Tip */}
      {showTip && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-xs glass rounded-2xl p-4 shadow-xl animate-fade-in-up z-40">
          <button
            onClick={dismissTip}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
          >
            ✕
          </button>
          <p className="text-sm font-medium mb-1 pr-6">💡 Quick Tip</p>
          <p className="text-xs text-muted-foreground">
            Text any TikTok link to{" "}
            <a href="tel:+18047016243" className="text-primary">
              +1 804 701 6243
            </a>{" "}
            to add it here. We&apos;ll automatically categorize it!
          </p>
        </div>
      )}
    </main>
  );
}
