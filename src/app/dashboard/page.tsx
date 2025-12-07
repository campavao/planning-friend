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
  const router = useRouter();

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
    <main className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h1 className="font-semibold text-lg">TikTok Helper</h1>
              <p className="text-xs text-muted-foreground">
                {user?.phoneNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/planner">
              <Button variant="default" size="sm">
                📅 Plan Week
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
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
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
        <div className="glass rounded-2xl p-6 mb-8 animate-fade-in-up opacity-0">
          <div className="flex flex-wrap gap-6 justify-center md:justify-start">
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-primary">
                {completedContent.length}
              </p>
              <p className="text-sm text-muted-foreground">Total Saves</p>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-meal">
                {completedContent.filter((c) => c.category === "meal").length}
              </p>
              <p className="text-sm text-muted-foreground">Meals</p>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-event">
                {completedContent.filter((c) => c.category === "event").length}
              </p>
              <p className="text-sm text-muted-foreground">Events</p>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-date">
                {
                  completedContent.filter((c) => c.category === "date_idea")
                    .length
                }
              </p>
              <p className="text-sm text-muted-foreground">Date Ideas</p>
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

      {/* Floating Help */}
      <div className="fixed bottom-6 right-6 glass rounded-2xl p-4 max-w-xs shadow-xl animate-fade-in-up opacity-0 stagger-3">
        <p className="text-sm font-medium mb-1">💡 Quick Tip</p>
        <p className="text-xs text-muted-foreground">
          Text any TikTok link to your number to add it here. We&apos;ll
          automatically categorize it!
        </p>
      </div>
    </main>
  );
}
