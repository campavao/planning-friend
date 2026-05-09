"use client";

import Link from "next/link";
import {
  Calendar,
  Coffee,
  Heart,
  Plus,
  RefreshCw,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import type { Content, ContentCategory, Tag } from "@/lib/supabase";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  meal: Utensils,
  drink: Coffee,
  event: Calendar,
  date_idea: Heart,
};

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
  onDismiss: (contentId: string, dayIndex: number) => void;
  onRefresh: (dayIndex: number) => void;
  isRefreshing?: boolean;
  emptyPool?: boolean;
  loading?: boolean;
  layout?: "mobile" | "desktop";
}

function StripHeader({
  isRefreshing,
  loading,
  onRefresh,
  dayIndex,
}: {
  isRefreshing: boolean;
  loading: boolean;
  onRefresh: (dayIndex: number) => void;
  dayIndex: number;
}) {
  return (
    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
      <span className="flex items-center gap-1 font-medium">
        <Sparkles className="w-3 h-3" />
        Suggested
      </span>
      <button
        onClick={() => onRefresh(dayIndex)}
        disabled={isRefreshing || loading}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors disabled:opacity-50"
        title="Refresh suggestions"
      >
        <RefreshCw
          className={`w-3 h-3 ${isRefreshing || loading ? "animate-spin" : ""}`}
        />
      </button>
    </div>
  );
}

function SkeletonChip({ isCompact }: { isCompact: boolean }) {
  return (
    <div
      className={`bg-[var(--background-alt)] border border-[var(--border)] rounded-xl flex items-stretch overflow-hidden animate-pulse ${
        isCompact ? "min-h-[44px]" : "min-h-[52px]"
      }`}
    >
      {!isCompact && <div className="w-12 shrink-0 bg-[var(--muted)]" />}
      <div className="flex-1 min-w-0 px-2 py-1.5 flex flex-col gap-1 justify-center">
        <div className="h-2 w-12 rounded bg-[var(--muted)]" />
        <div
          className={`${isCompact ? "h-2.5" : "h-3"} w-3/4 rounded bg-[var(--muted)]`}
        />
      </div>
      <div className="flex flex-col gap-1 px-1.5 py-1 justify-center">
        <div className="w-6 h-6 rounded-md bg-[var(--muted)]" />
        <div className="w-6 h-6 rounded-md bg-[var(--muted)]" />
      </div>
    </div>
  );
}

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
  loading = false,
  layout = "mobile",
}: SuggestionStripProps) {
  const isCompact = layout === "desktop";

  if (loading) {
    return (
      <div className="space-y-2">
        <StripHeader
          isRefreshing={isRefreshing}
          loading={loading}
          onRefresh={onRefresh}
          dayIndex={dayIndex}
        />
        <div className="space-y-1.5">
          <SkeletonChip isCompact={isCompact} />
          <SkeletonChip isCompact={isCompact} />
        </div>
      </div>
    );
  }

  if (emptyPool) {
    return (
      <div className="text-xs text-muted-foreground text-center px-3 py-4 border border-dashed border-[var(--border)] rounded-lg">
        Save 3+ ideas to unlock smart suggestions.
      </div>
    );
  }

  const visiblePicks = picks.filter((p) => contentById.has(p.contentId));
  if (visiblePicks.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No plans yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <StripHeader
        isRefreshing={isRefreshing}
        loading={false}
        onRefresh={onRefresh}
        dayIndex={dayIndex}
      />

      <div className="space-y-1.5">
        {visiblePicks.slice(0, 3).map((pick) => {
          const content = contentById.get(pick.contentId);
          if (!content) return null;
          const category = (content.category ?? "other") as ContentCategory;
          const Icon = CATEGORY_ICONS[category] ?? Utensils;
          const detailHref = `/dashboard/${content.id}?from=planner&week=${weekStart}`;

          return (
            <div
              key={pick.contentId}
              className={`group relative bg-[var(--background-alt)] border border-[var(--border)] rounded-xl flex items-stretch overflow-hidden ${
                isCompact ? "min-h-[44px]" : "min-h-[52px]"
              }`}
            >
              <Link
                href={detailHref}
                className="flex flex-1 min-w-0 items-stretch hover:bg-[var(--muted)]/40 transition-colors"
              >
                {content.thumbnail_url && !isCompact && (
                  <div className="w-12 shrink-0 relative overflow-hidden">
                    <img
                      src={content.thumbnail_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 px-2 py-1.5 flex flex-col gap-0.5 justify-center">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wide">
                      {category.replace("_", " ")}
                    </span>
                  </div>
                  <p
                    className={`font-medium ${isCompact ? "text-[11px]" : "text-xs"} line-clamp-1`}
                  >
                    {content.title}
                  </p>
                  {pick.why && (
                    <p className="text-[10px] text-muted-foreground italic line-clamp-1">
                      {pick.why}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex flex-col gap-1 px-1.5 py-1 justify-center">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAdd(pick.contentId, dayIndex);
                  }}
                  className="bg-[var(--primary)] text-white rounded-md w-6 h-6 flex items-center justify-center hover:bg-[var(--primary-dark)] transition-colors"
                  title="Add to plan"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDismiss(pick.contentId, dayIndex);
                  }}
                  className="bg-white/70 text-muted-foreground rounded-md w-6 h-6 flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
