"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { AddToHomeScreenPrompt } from "@/components/add-to-homescreen-button";
import { ContentCard } from "@/components/content-card";
import { NamePromptModal } from "@/components/name-prompt-modal";
import { PlanItemCard } from "@/components/plan-item-card";
import { CardRailSkeleton } from "@/components/Skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useContent } from "@/hooks/useContent";
import { usePlanner } from "@/hooks/usePlanner";
import { useSlideIn } from "@/hooks/useSlideIn";
import { getItemDateKey } from "@/lib/plan-dates";
import { fetcher } from "@/lib/swr-config";
import type { GiftRecipientWithAssignments, PlanItem } from "@/lib/supabase";
import {
  formatDateString,
  getWeekStartDay,
  getWeekStartForDate,
} from "@/lib/utils";
import { CalendarPlus, Check, Gift, Sparkles, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { useSession } from "./useSession";

// The rail previews the collection; "See all" in its header opens the rest.
const COLLECTION_PREVIEW_COUNT = 10;

// Today is a list, so it's capped — past this the planner is the better view.
const TODAY_LIST_LIMIT = 4;

// The clock is browser state. This page is prerendered, so reading it during
// render would bake the build machine's date into the HTML — hence a null
// server snapshot. Re-reading on visibilitychange also means a PWA left open
// for days notices when "today" has moved on.
let cachedNow: Date | null = null;

function subscribeToClock(onChange: () => void) {
  const refresh = () => {
    cachedNow = new Date();
    onChange();
  };
  document.addEventListener("visibilitychange", refresh);
  return () => document.removeEventListener("visibilitychange", refresh);
}

function getClientNow(): Date {
  if (!cachedNow) cachedNow = new Date();
  return cachedNow;
}

function useNow(): Date | null {
  return useSyncExternalStore(subscribeToClock, getClientNow, () => null);
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  /** The way into the full page, at the header's right — "See all 5". */
  action: { href: string; label: string };
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-baseline justify-between mb-3">
      <h2 className="heading-2">{title}</h2>
      <Link
        href={action.href}
        className="shrink-0 text-sm font-semibold text-[var(--primary)] hover:underline"
      >
        {action.label}
      </Link>
    </div>
  );
}

/**
 * Horizontal rail of cards. Every row on this page uses the same square card
 * as the collection grid at a fixed width, so the whole dashboard scans as one
 * system no matter which section you're looking at.
 */
function CardRail({ children }: { children: ReactNode }) {
  return (
    // overflow-x-auto forces the computed overflow-y to auto as well, so this
    // box clips vertically too and shaves the cards' shadows off. The track's
    // vertical padding clears them — --shadow-card and --shadow-lg are both
    // 0 8px 24px, which reaches 20px below a card (8px offset plus half the
    // 24px blur) and 8px above one that's hover-lifted — and these negative
    // margins hand back exactly what that padding added, 4px of the bottom
    // having been there already, so the rows sit where they always did.
    <div className="max-w-7xl mx-auto -mt-2 -mb-4 overflow-x-auto hide-scrollbar">
      {/* The horizontal padding lives on the track rather than the scroll
          container: a scroll container's leading padding is scrolled away (and
          snapping aligns the first card flush past it), which left the row
          starting hard against the screen edge while its header was indented.
          It doubles as the side clearance the shadows need: 16px of it against
          a 12px reach. */}
      <div className="flex w-max gap-3 px-4 md:px-6 pt-2 pb-5">{children}</div>
    </div>
  );
}

function RailItem({ children }: { children: ReactNode }) {
  return <div className="w-36 md:w-44 shrink-0">{children}</div>;
}

function EmptySection({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <Card className="p-6 text-center">{children}</Card>
    </div>
  );
}

export default function DashboardHome() {
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const now = useNow();
  // Sections slide in the first time the dashboard is shown, then stay put on
  // every return trip from another tab.
  const slideIn = useSlideIn("dashboard-section") ? "animate-slide-up" : "";

  // Kept for the redirect when a session expires — but nothing on this page
  // waits for it. Middleware already refused the request without a valid
  // session, so gating the data hooks on the session fetch only bought a
  // serial round trip: cached content couldn't paint until the session
  // resolved, and the page visibly rebuilt itself when it did.
  const { user } = useSession();

  const today = now ? formatDateString(now) : null;
  const weekStart = now ? getWeekStartForDate(now, getWeekStartDay()) : null;

  const { content, isLoading: contentLoading } = useContent();
  const { plan, sharedItems, isLoading: plannerLoading } = usePlanner(weekStart);
  const { data: nameData } = useSWR<{ name: string | null }>(
    "/api/users/name",
    fetcher
  );
  const { data: giftData, isLoading: giftsLoading } = useSWR<{
    recipients: GiftRecipientWithAssignments[];
  }>("/api/gifts/recipients?include=assignments", fetcher);

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

  // Everything planned for today: own items, auto-added events, and anything
  // a friend shared onto today. Bucket by getItemDateKey — manual items store
  // a bare YYYY-MM-DD while auto-events store a full timestamp, so comparing
  // planned_date as a string would silently drop every auto-event.
  const todayItems = useMemo(() => {
    if (!today) return [];
    const items: PlanItem[] = [...(plan?.items ?? []), ...sharedItems];
    return items
      .filter((item) => getItemDateKey(item) === today)
      .sort((a, b) => a.slot_order - b.slot_order);
  }, [plan, sharedItems, today]);

  const collectionPreview = content.slice(0, COLLECTION_PREVIEW_COUNT);
  const savedCount = content.filter((c) => c.status === "completed").length;
  const recipients = giftData?.recipients ?? [];

  // Without a clock there's no "today" to query yet, so the rail is still
  // loading — showing its empty state here would claim nothing is planned and
  // then take it back a frame later.
  const todayLoading = !now || (plannerLoading && todayItems.length === 0);

  const firstName = nameData?.name?.trim().split(/\s+/)[0];
  const todaySummary = todayLoading
    ? " "
    : todayItems.length === 0
      ? "Nothing planned today"
      : `${todayItems.length} ${
          todayItems.length === 1 ? "thing" : "things"
        } planned today`;

  // The date small above, the greeting by name, and a line on the day — the
  // whole morning check in three lines.
  const header = (
    <div className="sticky top-0 z-20 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-2 pb-3">
        <p className="text-xs text-muted-foreground">
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : " "}
        </p>
        <h1 className="heading-2 mt-0.5">
          {now ? greetingFor(now) : "Hello"}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{todaySummary}</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {header}

      <div className="py-6 space-y-8">
        {/* Today — a short list, not a rail: it's what you act on, and it
            reads the same as the day does in the planner. */}
        <section className={slideIn}>
          <SectionHeader
            title="Today"
            action={{ href: "/dashboard/planner", label: "Planner" }}
          />
          {todayLoading ? (
            <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-3">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : todayItems.length === 0 ? (
            <EmptySection>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--event-bg)] flex items-center justify-center">
                <CalendarPlus className="w-7 h-7 text-[var(--event)]" />
              </div>
              <p className="font-semibold mb-1">Nothing planned today</p>
              <p className="text-sm text-muted-foreground mb-4">
                Pull something from your collection into the day.
              </p>
              <Link
                href="/dashboard/planner"
                className="text-sm font-semibold text-[var(--primary)]"
              >
                Open the planner
              </Link>
            </EmptySection>
          ) : (
            // Room on the right and top for each card's tilted thumbnail.
            <div className="max-w-7xl mx-auto pl-4 pr-6 md:pl-6 md:pr-8 pt-3 space-y-4">
              {todayItems.slice(0, TODAY_LIST_LIMIT).map((item, index) => (
                <PlanItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  href={
                    item.content_id
                      ? `/dashboard/${item.content_id}?from=home`
                      : null
                  }
                />
              ))}
              {todayItems.length > TODAY_LIST_LIMIT && (
                <Link
                  href="/dashboard/planner"
                  className="block text-sm font-semibold text-[var(--primary)]"
                >
                  {todayItems.length - TODAY_LIST_LIMIT} more in the planner
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Collection */}
        <section className={`${slideIn} stagger-2`}>
          <SectionHeader
            title="Collection"
            action={{
              href: "/dashboard/collection",
              label: savedCount > 0 ? `See all ${savedCount}` : "See all",
            }}
          />
          {contentLoading && content.length === 0 ? (
            <CardRailSkeleton />
          ) : content.length === 0 ? (
            <EmptySection>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--primary-light)]/30 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-[var(--primary)]" />
              </div>
              <p className="font-semibold mb-1">Your collection is empty</p>
              <p className="text-sm text-muted-foreground mb-4">
                Text a TikTok, Reel, or link to <AddContactButton variant="link" />{" "}
                and it lands here.
              </p>
              <AddContactButton variant="button" className="text-sm h-9" />
            </EmptySection>
          ) : (
            <CardRail>
              {collectionPreview.map((item, index) => (
                <RailItem key={item.id}>
                  <ContentCard
                    content={item}
                    index={index}
                    href={`/dashboard/${item.id}?from=home`}
                  />
                </RailItem>
              ))}
            </CardRail>
          )}
        </section>

        {/* Gifts — people as a strip of avatars: a name and a count is all
            each one says, and a tall card per person spent a screen on it. */}
        <section className={`${slideIn} stagger-2`}>
          <SectionHeader
            title="Gifts"
            action={{ href: "/dashboard/gifts", label: "See all" }}
          />
          {giftsLoading && recipients.length === 0 ? (
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="size-14 rounded-full" />
              ))}
            </div>
          ) : recipients.length === 0 ? (
            <EmptySection>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--gift-bg)] flex items-center justify-center">
                <Gift className="w-7 h-7 text-[var(--gift)]" />
              </div>
              <p className="font-semibold mb-1">No one to shop for yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add the people you buy for and keep their gift ideas together.
              </p>
              <Link
                href="/dashboard/gifts"
                className="text-sm font-semibold text-[var(--primary)]"
              >
                Add a person
              </Link>
            </EmptySection>
          ) : (
            <div className="max-w-7xl mx-auto overflow-x-auto hide-scrollbar">
              <div className="flex w-max gap-4 px-4 md:px-6 pt-1 pb-2">
                {recipients.map((recipient) => {
                  const pending = recipient.assignments.filter(
                    (a) => !a.given_at
                  ).length;
                  return (
                    <Link
                      key={recipient.id}
                      href="/dashboard/gifts"
                      aria-label={`${recipient.name}, ${
                        pending > 0
                          ? `${pending} to buy`
                          : recipient.assignments.length > 0
                            ? "all set"
                            : "no gift ideas yet"
                      }`}
                      className="w-16 flex flex-col items-center gap-1.5 text-center"
                    >
                      <span className="relative flex size-14 items-center justify-center rounded-full bg-[var(--gift-bg)] text-lg font-semibold text-[var(--gift)]">
                        {recipient.name.charAt(0).toUpperCase()}
                        {pending > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white ring-2 ring-[var(--background)]">
                            {pending}
                          </span>
                        ) : recipient.assignments.length > 0 ? (
                          // Bought for, not merely empty: someone with no
                          // ideas yet isn't "all set".
                          <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[var(--secondary-dark)] text-white ring-2 ring-[var(--background)]">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </span>
                      <span className="w-full truncate text-xs font-medium">
                        {recipient.name}
                      </span>
                    </Link>
                  );
                })}
                <Link
                  href="/dashboard/gifts"
                  className="w-16 flex flex-col items-center gap-1.5 text-center"
                >
                  <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)] text-muted-foreground">
                    <UserPlus className="size-5" />
                  </span>
                  <span className="text-xs text-muted-foreground">Add</span>
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

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
