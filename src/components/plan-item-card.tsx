"use client";

import { ContentCard } from "@/components/content-card";
import { formatItemTime } from "@/lib/plan-dates";
import type { Content, PlanItem } from "@/lib/supabase";
import { Clock, StickyNote } from "lucide-react";

/**
 * A planner entry is either a saved collection item or a quick note typed
 * straight into a day. Quick notes have no content row behind them, so we
 * synthesize one and let the card's existing no-photo variant carry it —
 * that's what keeps the planner on the same card as everything else.
 */
export function planItemAsContent(item: PlanItem): Content {
  if (item.content) return item.content;

  return {
    id: item.id,
    user_id: "",
    tiktok_url: "",
    category: "other",
    title: item.note_title || "Quick note",
    data: item.notes ? { description: item.notes } : {},
    status: "completed",
    created_at: item.created_at,
  };
}

interface PlanItemCardProps {
  item: PlanItem;
  index?: number;
  /**
   * Where tapping the card goes. Defaults to the item's detail page; quick
   * notes are always unlinked since there's no detail page to open.
   */
  href?: string | null;
}

export function PlanItemCard({ item, index = 0, href }: PlanItemCardProps) {
  const content = planItemAsContent(item);
  const isQuickNote = !item.content_id;
  // A plan item carries its own time of day in planned_date (read in UTC —
  // see plan-dates), not in the content it points at.
  const time = formatItemTime(item);

  // Leaving meta undefined lets the card fall back to its category meta.
  const meta =
    time || isQuickNote ? (
      <div className="flex items-center gap-1.5 text-xs">
        {time ? (
          <>
            <Clock className="w-3 h-3" />
            <span>{time}</span>
          </>
        ) : (
          <>
            <StickyNote className="w-3 h-3" />
            <span>Quick note</span>
          </>
        )}
      </div>
    ) : undefined;

  return (
    <ContentCard
      content={content}
      index={index}
      href={isQuickNote ? null : href}
      meta={meta}
    />
  );
}
