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
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "./useSession";

// Initialize tip visibility from localStorage
function getInitialTipVisibility() {
  if (typeof window === "undefined") return true;
  return !localStorage.getItem("tipDismissed");
}

export default function Dashboard() {
  const router = useRouter();
  const [showTip, setShowTip] = useState(getInitialTipVisibility);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  // Redirect to last active tab if user is returning to the app
  useEffect(() => {
    try {
      const lastTab = localStorage.getItem("lastTab");
      if (lastTab && lastTab !== "/dashboard") {
        router.replace(lastTab);
      }
    } catch {
      // Ignore storage errors
    }
  }, [router]);

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
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            Loading your collection...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-light)]/20 via-transparent to-[var(--accent)]/10" />
          <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="heading-1">
                  My Collection
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {completedContent.length} saved items
                </p>
              </div>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center gap-3">
                <Link href="/dashboard/planner">
                  <Button className="btn-primary">
                    <Calendar className="w-4 h-4 mr-2" />
                    Plan Week
                  </Button>
                </Link>
                <Link href="/dashboard/gifts">
                  <Button className="btn-outline">
                    <Gift className="w-4 h-4 mr-2" />
                    Gifts
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isValidating}
                  className="btn-ghost w-10 h-10 rounded-xl"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isValidating ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-4">
          <div className="grid grid-cols-5 gap-2 animate-slide-up">
            <div className="stat-card">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[var(--meal-bg)] flex items-center justify-center">
                <Utensils className="w-4 h-4 text-[var(--meal)]" />
              </div>
              <div className="stat-value">{mealCount}</div>
              <div className="stat-label">Meals</div>
            </div>
            <div className="stat-card">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[var(--drink-bg)] flex items-center justify-center">
                <Coffee className="w-4 h-4 text-[var(--drink)]" />
              </div>
              <div className="stat-value">{drinkCount}</div>
              <div className="stat-label">Drinks</div>
            </div>
            <div className="stat-card">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[var(--event-bg)] flex items-center justify-center">
                <Calendar className="w-4 h-4 text-[var(--event)]" />
              </div>
              <div className="stat-value">{eventCount}</div>
              <div className="stat-label">Events</div>
            </div>
            <div className="stat-card">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[var(--date-bg)] flex items-center justify-center">
                <Heart className="w-4 h-4 text-[var(--date)]" />
              </div>
              <div className="stat-value">{dateCount}</div>
              <div className="stat-label">Dates</div>
            </div>
            <div className="stat-card">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[var(--gift-bg)] flex items-center justify-center">
                <Gift className="w-4 h-4 text-[var(--gift)]" />
              </div>
              <div className="stat-value">{giftCount}</div>
              <div className="stat-label">Gifts</div>
            </div>
          </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Processing Banner */}
        {processingCount > 0 && (
          <div className="card-flat state-processing p-4 mb-6 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white animate-pulse-soft" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  Processing {processingCount} item
                  {processingCount > 1 ? "s" : ""}
                </p>
                <div className="loading-bar mt-2 w-48" />
              </div>
            </div>
          </div>
        )}

        {/* Failed Items Banner */}
        {failedCount > 0 && (
          <div className="card-flat state-error p-4 mb-6 animate-slide-up">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold">
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
                className="text-destructive hover:bg-red-50"
              >
                Dismiss All
              </Button>
            </div>
            <div className="space-y-2">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-3 bg-white rounded-lg"
                >
                  <p className="text-sm truncate flex-1 text-muted-foreground">
                    {item.tiktok_url}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissContent(item.id)}
                    className="text-destructive hover:bg-red-50 shrink-0 h-7 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="text-center py-16 card-elevated animate-scale-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-destructive mb-4 font-medium">
              Failed to load content
            </p>
            <Button onClick={handleRefresh} className="btn-primary">
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
          <div className="card-elevated p-5 animate-slide-up">
            <button
              onClick={dismissTip}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold mb-1">Quick Tip</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Text any TikTok or Instagram link to{" "}
                  <AddContactButton variant="link" /> to add it here.
                </p>
                <AddContactButton variant="button" className="w-full text-sm h-9" />
              </div>
            </div>
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
