"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { AddToHomeScreenPrompt } from "@/components/add-to-homescreen-button";
import { CategoryTabs } from "@/components/category-tabs";
import { NamePromptModal } from "@/components/name-prompt-modal";
import { Button } from "@/components/ui/button";
import type { ContentWithTags, Tag } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "./useSession";

export default function Dashboard() {
  const [content, setContent] = useState<ContentWithTags[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTip, setShowTip] = useState(true);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const router = useRouter();

  // Check if tip was dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem("tipDismissed");
    if (dismissed) setShowTip(false);
  }, []);

  // Check if user needs to set their name
  useEffect(() => {
    async function checkUserName() {
      // Skip if already seen the prompt
      const hasSeenPrompt = localStorage.getItem("hasSeenNamePrompt");
      if (hasSeenPrompt) return;

      try {
        const res = await fetch("/api/users/name");
        if (res.ok) {
          const data = await res.json();
          if (!data.hasName) {
            setShowNamePrompt(true);
          }
        }
      } catch (error) {
        console.error("Failed to check user name:", error);
      }
    }

    if (user) {
      checkUserName();
    }
  }, [user]);

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("tipDismissed", "true");
  };

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch("/api/content?includeTags=true");
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/");
          return;
        }
        throw new Error(data.error || "Failed to fetch content");
      }

      setContent(data.content);
      if (data.tags) {
        setTags(data.tags);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    }
  }, [router]);

  useSession({
    onSuccess: async () => {
      await fetchContent();
    },
    onFinishLoading: () => {
      setLoading(false);
    },
  });

  // Poll for updates when there are processing items
  useEffect(() => {
    const hasProcessing = content.some((c) => c.status === "processing");

    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchContent();
    }, 3000);

    return () => clearInterval(interval);
  }, [content, fetchContent]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchContent();
    setLoading(false);
  };

  const handleDismissContent = async (contentId: string) => {
    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Remove from local state immediately for better UX
        setContent((prev) => prev.filter((c) => c.id !== contentId));
      }
    } catch (error) {
      console.error("Failed to dismiss content:", error);
    }
  };

  // Count stats (only completed items)
  const completedContent = content.filter((c) => c.status === "completed");
  const processingItems = content.filter((c) => c.status === "processing");
  const failedItems = content.filter((c) => c.status === "failed");
  const processingCount = processingItems.length;
  const failedCount = failedItems.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-shimmer w-16 h-16 rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground font-handwritten text-xl">
            Loading your saves...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-paper">
      {/* Header */}
      <div className="pt-6 pb-4 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Title with decoration */}
          <div className="flex items-center justify-between mb-2">
            <div className="relative">
              <h1 className="font-handwritten text-4xl md:text-5xl text-foreground transform -rotate-1">
                My Saves
              </h1>
              <div className="absolute -bottom-1 left-0 right-0 h-2 bg-washi-yellow/60 transform rotate-0.5 -z-10" />
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/dashboard/planner">
                <Button className="sticker sticker-event transform hover:scale-105 transition-transform">
                  📅 Plan Week
                </Button>
              </Link>
              <Link href="/dashboard/gifts">
                <Button variant="outline" className="hover:bg-washi-pink/20">
                  🎁 Gift Ideas
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="hover:bg-washi-mint/20"
              >
                🔄
              </Button>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-muted-foreground text-sm md:text-base">
            ✨ Your collection of discoveries & plans
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 md:px-4">
        {/* Processing Banner */}
        {processingCount > 0 && (
          <div className="scrapbook-card p-4 mb-4 border-l-4 border-l-washi-coral animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-wiggle">✂️</span>
              <div className="flex-1">
                <p className="font-medium font-handwritten text-lg">
                  Adding {processingCount} new clip
                  {processingCount > 1 ? "s" : ""}...
                </p>
                <p className="text-sm text-muted-foreground">
                  Processing your content
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Failed Items Banner */}
        {failedCount > 0 && (
          <div className="scrapbook-card p-4 mb-6 border-l-4 border-l-destructive">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">😕</span>
                <div>
                  <p className="font-medium font-handwritten text-lg">
                    {failedCount} item{failedCount > 1 ? "s" : ""} failed to
                    process
                  </p>
                  <p className="text-sm text-muted-foreground">
                    These links couldn&apos;t be saved
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  failedItems.forEach((item) => handleDismissContent(item.id));
                }}
                className="text-destructive hover:bg-destructive/10 shrink-0"
              >
                Dismiss All
              </Button>
            </div>
            <div className="space-y-2">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 bg-destructive/5 rounded-lg"
                >
                  <p className="text-sm truncate flex-1 text-muted-foreground">
                    {item.tiktok_url}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissContent(item.id)}
                    className="text-destructive hover:bg-destructive/10 shrink-0 h-7 px-2"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Banner - Styled like stickers */}
        <div className="scrapbook-card p-4 md:p-6 mb-6 md:mb-8 animate-fade-in-up opacity-0 relative overflow-hidden">
          {/* Decorative tape */}
          <div className="absolute -top-2 left-8 w-16 h-6 bg-washi-mint/80 transform -rotate-3" />
          <div className="absolute -top-2 right-12 w-12 h-6 bg-washi-pink/80 transform rotate-2" />

          <div className="grid grid-cols-5 gap-1 md:flex md:flex-wrap md:gap-6 md:justify-start pt-2">
            <div className="text-center">
              <div className="sticker sticker-other mx-auto mb-1 transform rotate-2">
                {completedContent.length}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                Total
              </p>
            </div>
            <div className="text-center">
              <div className="sticker sticker-meal mx-auto mb-1 transform -rotate-1">
                {completedContent.filter((c) => c.category === "meal").length}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                Meals
              </p>
            </div>
            <div className="text-center">
              <div className="sticker sticker-event mx-auto mb-1 transform rotate-1">
                {completedContent.filter((c) => c.category === "event").length}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                Events
              </p>
            </div>
            <div className="text-center">
              <div className="sticker sticker-date_idea mx-auto mb-1 transform -rotate-2">
                {
                  completedContent.filter((c) => c.category === "date_idea")
                    .length
                }
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                Dates
              </p>
            </div>
            <div className="text-center">
              <div className="sticker sticker-gift_idea mx-auto mb-1 transform rotate-2">
                {
                  completedContent.filter((c) => c.category === "gift_idea")
                    .length
                }
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                Gifts
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-center py-12 scrapbook-card">
            <p className="text-destructive mb-4 font-handwritten text-xl">
              {error}
            </p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </div>
        ) : (
          <div className="animate-fade-in-up opacity-0 stagger-2">
            <CategoryTabs content={content} allTags={tags} />
          </div>
        )}
      </div>

      {/* Dismissible Quick Tip - Styled like a note */}
      {showTip && (
        <div className="hidden md:block fixed md:right-6 md:bottom-6 md:max-w-xs z-40">
          <div className="scrapbook-card p-4 shadow-xl animate-fade-in-up transform rotate-1 relative">
            {/* Tape decoration */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 bg-washi-yellow/80 transform -rotate-2" />

            <button
              onClick={dismissTip}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 text-lg"
            >
              ×
            </button>
            <p className="font-handwritten text-lg mb-2 pr-6">💡 Quick Tip!</p>
            <p className="text-sm text-muted-foreground mb-3">
              Text any TikTok or Instagram link to{" "}
              <AddContactButton variant="link" /> to add it here. Your Planning
              Friend will save it for you!
            </p>
            <AddContactButton variant="button" className="w-full text-sm h-8" />
          </div>
        </div>
      )}

      {/* Auto-show add to home screen prompt for first-time users */}
      <AddToHomeScreenPrompt />

      {/* Name prompt modal for first-time users */}
      {showNamePrompt && (
        <NamePromptModal
          onComplete={() => {
            setShowNamePrompt(false);
          }}
        />
      )}
    </main>
  );
}
