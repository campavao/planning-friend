"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { AddToHomeScreenPrompt } from "@/components/add-to-homescreen-button";
import { CategoryTabs } from "@/components/category-tabs";
import { NamePromptModal } from "@/components/name-prompt-modal";
import { Button } from "@/components/ui/button";
import { useContent } from "@/hooks/useContent";
import {
  AlertCircle,
  Calendar,
  Coffee,
  Gift,
  Heart,
  Loader2,
  RefreshCw,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "./useSession";

// Initialize tip visibility from localStorage
function getInitialTipVisibility() {
  if (typeof window === "undefined") return true;
  return !localStorage.getItem("tipDismissed");
}

export default function Dashboard() {
  const [showTip, setShowTip] = useState(getInitialTipVisibility);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  // Session management with SWR
  const { user, isLoading: sessionLoading } = useSession();

  // Content fetching with SWR - only fetch when session is validated
  const {
    content,
    tags,
    isLoading: contentLoading,
    isValidating,
    error,
    mutate: mutateContent,
  } = useContent({ enabled: !!user });

  // Combined loading state - show loading only on initial load, not revalidation
  const isInitialLoading =
    sessionLoading || (!!user && contentLoading && content.length === 0);

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("tipDismissed", "true");
  };

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

  // Poll for updates when there are processing items
  useEffect(() => {
    const hasProcessing = content.some((c) => c.status === "processing");

    if (!hasProcessing) return;

    const interval = setInterval(() => {
      mutateContent();
    }, 3000);

    return () => clearInterval(interval);
  }, [content, mutateContent]);

  const handleRefresh = () => {
    mutateContent();
  };

  const handleDismissContent = async (contentId: string) => {
    // Optimistic update - remove from cache immediately
    mutateContent(
      (currentData) => {
        if (!currentData) return currentData;
        return {
          ...currentData,
          content: currentData.content.filter((c) => c.id !== contentId),
        };
      },
      { revalidate: false }
    );

    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        // Revalidate to restore state if delete failed
        mutateContent();
      }
    } catch (error) {
      console.error("Failed to dismiss content:", error);
      // Revalidate to restore state on error
      mutateContent();
    }
  };

  // Count stats (only completed items)
  const completedContent = content.filter((c) => c.status === "completed");
  const processingItems = content.filter((c) => c.status === "processing");
  const failedItems = content.filter((c) => c.status === "failed");
  const processingCount = processingItems.length;
  const failedCount = failedItems.length;

  // Category counts
  const mealCount = completedContent.filter(
    (c) => c.category === "meal"
  ).length;
  const drinkCount = completedContent.filter(
    (c) => c.category === "drink"
  ).length;
  const eventCount = completedContent.filter(
    (c) => c.category === "event"
  ).length;
  const dateCount = completedContent.filter(
    (c) => c.category === "date_idea"
  ).length;
  const giftCount = completedContent.filter(
    (c) => c.category === "gift_idea"
  ).length;

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="brutal-loading w-32 mx-auto mb-4">
            <div className="brutal-loading-bar" />
          </div>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="brutal-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-tight">
              MY_SAVES
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {completedContent.length} items in collection
            </p>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/dashboard/planner">
              <Button className="brutal-btn">
                <Calendar className="w-4 h-4 mr-2" />
                Plan Week
              </Button>
            </Link>
            <Link href="/dashboard/gifts">
              <Button
                variant="outline"
                className="border-[3px] border-border hover:bg-accent"
              >
                <Gift className="w-4 h-4 mr-2" />
                Gifts
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isValidating}
              className="border-[3px] border-border hover:bg-accent"
            >
              <RefreshCw
                className={`w-4 h-4 ${isValidating ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Processing Banner */}
        {processingCount > 0 && (
          <div className="brutal-card-static brutal-processing p-4 mb-6 border-l-[6px] border-l-primary">
            <div className="flex items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin" />
              <div className="flex-1">
                <p className="font-bold font-mono uppercase">
                  Processing {processingCount} item
                  {processingCount > 1 ? "s" : ""}
                </p>
                <div className="brutal-loading mt-2 w-48">
                  <div className="brutal-loading-bar" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Failed Items Banner */}
        {failedCount > 0 && (
          <div className="brutal-card-static brutal-error p-4 mb-6 border-l-[6px] border-l-destructive">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <div>
                  <p className="font-bold font-mono uppercase">
                    {failedCount} item{failedCount > 1 ? "s" : ""} failed
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
                className="text-destructive hover:bg-destructive/10 border-2 border-destructive"
              >
                Dismiss All
              </Button>
            </div>
            <div className="space-y-2">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 bg-white border-2 border-border"
                >
                  <p className="text-sm truncate flex-1 text-muted-foreground font-mono">
                    {item.tiktok_url}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissContent(item.id)}
                    className="text-destructive hover:bg-destructive/10 shrink-0 h-7 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="brutal-card-static mb-6 animate-slide-up">
          <div className="grid grid-cols-5 border-b-[3px] border-border">
            <div className="stat-box">
              <Utensils className="w-6 h-6 mx-auto mb-1" />
              <div className="stat-count">
                {String(mealCount).padStart(2, "0")}
              </div>
              <div className="stat-label">Meals</div>
            </div>
            <div className="stat-box">
              <Coffee className="w-6 h-6 mx-auto mb-1" />
              <div className="stat-count">
                {String(drinkCount).padStart(2, "0")}
              </div>
              <div className="stat-label">Drinks</div>
            </div>
            <div className="stat-box">
              <Calendar className="w-6 h-6 mx-auto mb-1" />
              <div className="stat-count">
                {String(eventCount).padStart(2, "0")}
              </div>
              <div className="stat-label">Events</div>
            </div>
            <div className="stat-box">
              <Heart className="w-6 h-6 mx-auto mb-1" />
              <div className="stat-count">
                {String(dateCount).padStart(2, "0")}
              </div>
              <div className="stat-label">Dates</div>
            </div>
            <div className="stat-box border-r-0">
              <Gift className="w-6 h-6 mx-auto mb-1" />
              <div className="stat-count">
                {String(giftCount).padStart(2, "0")}
              </div>
              <div className="stat-label">Gifts</div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-center py-12 brutal-card-static">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive mb-4 font-mono uppercase">
              Failed to load content
            </p>
            <Button onClick={handleRefresh} className="brutal-btn">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="animate-slide-up stagger-2">
            <CategoryTabs content={content} allTags={tags} />
          </div>
        )}
      </div>

      {/* Dismissible Quick Tip */}
      {showTip && (
        <div className="hidden md:block fixed md:right-6 md:bottom-6 md:max-w-xs z-40">
          <div className="brutal-card-static p-4 animate-slide-up">
            <button
              onClick={dismissTip}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="font-mono text-sm font-bold uppercase mb-2">
              Quick Tip
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Text any TikTok or Instagram link to{" "}
              <AddContactButton variant="link" /> to add it here.
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
