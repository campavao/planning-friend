"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { AddToHomeScreenPrompt } from "@/components/add-to-homescreen-button";
import { ContentCard } from "@/components/content-card";
import { NamePromptModal } from "@/components/name-prompt-modal";
import { PlanItemCard } from "@/components/plan-item-card";
import { CardRailSkeleton } from "@/components/Skeletons";
import { Card } from "@/components/ui/card";
import { useContent } from "@/hooks/useContent";
import { usePlanner } from "@/hooks/usePlanner";
import { getItemDateKey } from "@/lib/plan-dates";
import { fetcher } from "@/lib/swr-config";
import type { GiftRecipientWithAssignments, PlanItem } from "@/lib/supabase";
import {
  formatDateString,
  getWeekStartDay,
  getWeekStartForDate,
} from "@/lib/utils";
import {
  CalendarPlus,
  ChevronRight,
  Gift,
  LayoutGrid,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { useSession } from "./useSession";

// The rail previews the collection; the tile at the end opens the full page.
const COLLECTION_PREVIEW_COUNT = 10;

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
  href,
  hint,
}: {
  title: string;
  href: string;
  hint?: string;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between mb-3">
      <Link href={href} className="group flex items-center gap-1">
        <h2 className="heading-2">{title}</h2>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[var(--primary)] transition-colors" />
      </Link>
      {hint && (
        <span className="text-sm text-muted-foreground shrink-0">{hint}</span>
      )}
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
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x px-4 md:px-6 pb-1">
        {children}
      </div>
    </div>
  );
}

function RailItem({ children }: { children: ReactNode }) {
  return (
    <div className="w-36 md:w-44 shrink-0 snap-start">{children}</div>
  );
}

/** Dashed tile that closes out a rail — "add another", "see everything". */
function RailAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: ElementType;
  label: string;
}) {
  return (
    <RailItem>
      <Link href={href} className="block h-full">
        <Card className="h-full min-h-44 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border)] bg-transparent shadow-none hover:border-[var(--primary)] hover:bg-[var(--background-alt)] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <span className="px-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </Card>
      </Link>
    </RailItem>
  );
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

  const { user, isLoading: sessionLoading } = useSession();

  const today = now ? formatDateString(now) : null;
  const weekStart = now ? getWeekStartForDate(now, getWeekStartDay()) : null;

  const { content, isLoading: contentLoading } = useContent({ enabled: !!user });
  const { plan, sharedItems, isLoading: plannerLoading } = usePlanner(
    weekStart,
    { enabled: !!user }
  );
  const { data: giftData, isLoading: giftsLoading } = useSWR<{
    recipients: GiftRecipientWithAssignments[];
  }>(user ? "/api/gifts/recipients?include=assignments" : null, fetcher);

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

  const header = (
    <div className="sticky top-0 z-20 bg-[var(--background)]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-light)]/20 via-transparent to-[var(--accent)]/10" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-3">
          <h1 className="heading-1">{now ? greetingFor(now) : "Hello"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {now
              ? now.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : " "}
          </p>
        </div>
      </div>
    </div>
  );

  if (sessionLoading || !now) {
    return (
      <main className="min-h-screen pb-28 md:pb-8 bg-background">
        {header}
        <div className="py-6 space-y-8">
          <CardRailSkeleton withTitle />
          <CardRailSkeleton withTitle />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {header}

      <div className="py-6 space-y-8">
        {/* Today */}
        <section className="animate-slide-up">
          <SectionHeader
            title="Today"
            href="/dashboard/planner"
            hint={
              todayItems.length > 0
                ? `${todayItems.length} planned`
                : undefined
            }
          />
          {plannerLoading && todayItems.length === 0 ? (
            <CardRailSkeleton count={2} />
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
            <CardRail>
              {todayItems.map((item, index) => (
                <RailItem key={item.id}>
                  <PlanItemCard
                    item={item}
                    index={index}
                    href={
                      item.content_id
                        ? `/dashboard/${item.content_id}?from=home`
                        : null
                    }
                  />
                </RailItem>
              ))}
              <RailAction
                href="/dashboard/planner"
                icon={CalendarPlus}
                label="Plan something"
              />
            </CardRail>
          )}
        </section>

        {/* Collection */}
        <section className="animate-slide-up stagger-2">
          <SectionHeader
            title="Collection"
            href="/dashboard/collection"
            hint={savedCount > 0 ? `${savedCount} saved` : undefined}
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
              <RailAction
                href="/dashboard/collection"
                icon={LayoutGrid}
                label={
                  savedCount > COLLECTION_PREVIEW_COUNT
                    ? `See all ${savedCount}`
                    : "See all"
                }
              />
            </CardRail>
          )}
        </section>

        {/* Gifts */}
        <section className="animate-slide-up stagger-2">
          <SectionHeader title="Gifts" href="/dashboard/gifts" />
          {giftsLoading && recipients.length === 0 ? (
            <CardRailSkeleton count={2} />
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
            <CardRail>
              {recipients.map((recipient) => {
                const pending = recipient.assignments.filter(
                  (a) => !a.given_at
                ).length;
                return (
                  <RailItem key={recipient.id}>
                    <Link href="/dashboard/gifts" className="block h-full">
                      <Card className="h-full min-h-44 p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--gift-bg)] flex items-center justify-center">
                          <span className="text-xl font-semibold text-[var(--gift)]">
                            {recipient.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm line-clamp-1">
                            {recipient.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pending > 0
                              ? `${pending} to buy`
                              : "All set"}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  </RailItem>
                );
              })}
              <RailAction
                href="/dashboard/gifts"
                icon={UserPlus}
                label="Add a person"
              />
            </CardRail>
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
