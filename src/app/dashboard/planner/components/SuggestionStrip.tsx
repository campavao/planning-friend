"use client";

import Link from "next/link";
import { ArrowLeftRight, RefreshCw, Sparkles } from "lucide-react";
import { AddToggle } from "@/components/add-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { Content, Tag } from "@/lib/supabase";
import { categoryUI } from "@/lib/categories";
import { contentMeta } from "@/lib/plan-item-details";
import { cn } from "@/lib/utils";

export interface SuggestionPickView {
  contentId: string;
  why: string | null;
}

export interface SuggestionStripProps {
  dayIndex: number;
  picks: SuggestionPickView[];
  contentById: Map<string, Content & { tags?: Tag[] }>;
  weekStart: string;
  onAdd: (contentId: string, dayIndex: number) => void;
  /** Drop this idea; the next one takes its place. */
  onDismiss: (contentId: string, dayIndex: number) => void;
  onRefresh: (dayIndex: number) => void;
  isRefreshing?: boolean;
  /** The library is too small for the engine to rank anything. */
  emptyPool?: boolean;
  /** False when the suggestion feature is switched off server-side. */
  featureEnabled?: boolean;
  loading?: boolean;
  layout?: "mobile" | "desktop";
}

/**
 * An idea, drawn as a draft: a dashed outline on the page rather than a
 * tinted card, so it reads as "this could go here", never as something you
 * planned. The ✨ marks the reason, and it is the only place the sparkle is
 * used — it means "an idea" everywhere in the planner.
 *
 * ⇄ swaps in the next idea, replacing the old dismiss button and the
 * separate refresh: what you want from a suggestion you don't like is a
 * different one.
 */
export function DraftRow({
  content,
  why,
  href,
  added = false,
  pending = false,
  onAdd,
  onSwap,
  compact = false,
}: {
  content: Content;
  why: string | null;
  href?: string;
  added?: boolean;
  pending?: boolean;
  onAdd: () => void;
  onSwap?: () => void;
  compact?: boolean;
}) {
  const ui = categoryUI(content.category);
  const body = (
    <>
      {content.thumbnail_url ? (
        <img
          src={content.thumbnail_url}
          alt=""
          className={cn(
            "shrink-0 rounded-full object-cover",
            compact ? "size-8" : "size-10"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full",
            ui.bg,
            compact ? "size-8" : "size-10"
          )}
        >
          <ui.icon className={cn("size-4", ui.text)} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "line-clamp-1 font-medium",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {content.title}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="size-3 shrink-0 text-[var(--accent)]" />
          <span className="line-clamp-1">
            {why ?? contentMeta(content) ?? ui.label}
          </span>
        </span>
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border border-dashed transition-colors",
        compact ? "px-2 py-1.5" : "px-3 py-2",
        added
          ? "border-transparent bg-[var(--meal-bg)]"
          : "border-[var(--border-strong)]"
      )}
    >
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{body}</div>
      )}
      {onSwap && !added && (
        <button
          type="button"
          onClick={onSwap}
          aria-label={`Show another idea instead of ${content.title}`}
          title="Another idea"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--muted)] hover:text-foreground"
        >
          <ArrowLeftRight className="size-4" />
        </button>
      )}
      <AddToggle
        added={added}
        pending={pending}
        label={content.title}
        onToggle={onAdd}
        className={compact ? "size-8" : undefined}
      />
    </div>
  );
}

function DraftSkeleton({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border border-dashed border-[var(--border-strong)]",
        compact ? "px-2 py-1.5" : "px-3 py-2"
      )}
    >
      <Skeleton className={cn("rounded-full", compact ? "size-8" : "size-10")} />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-3/4 rounded" />
        <Skeleton className="h-2.5 w-1/2 rounded" />
      </div>
      <Skeleton className="size-9 rounded-full" />
    </div>
  );
}

/**
 * The idea shown on an empty day in the planner list. One at a time: the day
 * is empty, so one suggestion fills it, and ⇄ brings the next.
 */
export function SuggestionStrip({
  dayIndex,
  picks,
  contentById,
  weekStart,
  onAdd,
  onDismiss,
  onRefresh,
  isRefreshing = false,
  emptyPool = false,
  featureEnabled = true,
  loading = false,
  layout = "mobile",
}: SuggestionStripProps) {
  const compact = layout === "desktop";

  if (loading) {
    return (
      <div aria-label="Loading an idea" aria-busy="true">
        <DraftSkeleton compact={compact} />
      </div>
    );
  }

  // Nothing to suggest because the feature is off — say what an empty day is,
  // not that the engine came up short.
  if (!featureEnabled) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No plans yet
      </div>
    );
  }

  if (emptyPool) {
    return (
      <div className="text-xs text-muted-foreground text-center px-3 py-4 border border-dashed border-[var(--border)] rounded-2xl">
        Save 3+ ideas to unlock smart suggestions.
      </div>
    );
  }

  // The engine ran and has nothing left for this day: everything in the
  // library is planned already or was swapped away. Say so, and offer to look
  // again — an empty day is a state, not a failure.
  const pick = picks.find((p) => contentById.has(p.contentId));
  const content = pick ? contentById.get(pick.contentId) : undefined;
  if (!pick || !content) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--border)] px-3 py-2.5 text-xs text-muted-foreground">
        <span>No more ideas for this day</span>
        <button
          type="button"
          onClick={() => onRefresh(dayIndex)}
          disabled={isRefreshing}
          title="Refresh suggestions"
          className="inline-flex items-center gap-1 font-medium text-[var(--primary)] disabled:opacity-60"
        >
          <RefreshCw
            className={cn("size-3", isRefreshing && "animate-spin")}
          />
          Find more
        </button>
      </div>
    );
  }

  return (
    <DraftRow
      content={content}
      why={pick.why}
      href={`/dashboard/${content.id}?from=planner&week=${weekStart}`}
      onAdd={() => onAdd(pick.contentId, dayIndex)}
      onSwap={() => onDismiss(pick.contentId, dayIndex)}
      compact={compact}
    />
  );
}
