"use client";

import { TypeChip } from "@/components/type-chip";
import { categoryUI } from "@/lib/categories";
import { formatItemTime } from "@/lib/plan-dates";
import { planItemMeta } from "@/lib/plan-item-details";
import type { PlanItem } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PlanItemCardProps {
  item: PlanItem;
  /** Alternates the thumbnail's tilt down a list. */
  index?: number;
  /**
   * Where tapping the card goes. Quick notes pass null: there's no detail
   * page behind them.
   */
  href: string | null;
}

/**
 * A planned item as a row: the planner's card face — category tint, the time
 * chip with the type icon, a serif title, one meta line, and the tilted
 * thumbnail tucked into the corner — without its buttons or the expanding
 * details. The home page's Today list uses it so a day reads the same there
 * as it does in the planner.
 */
export function PlanItemCard({ item, index = 0, href }: PlanItemCardProps) {
  const isQuickNote = !item.content_id;
  const title = item.content?.title ?? item.note_title ?? "Quick note";
  const meta = isQuickNote ? item.notes?.trim() : planItemMeta(item);
  const tint = isQuickNote
    ? "bg-[var(--accent-light)]"
    : categoryUI(item.content?.category || "other").bg;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-[var(--border)]",
        tint
      )}
    >
      {href && (
        // A stretched link, as in CardLink: the whole card navigates and it
        // stays a real anchor for cmd-click and "copy link".
        <Link
          href={href}
          aria-label={title}
          className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
      )}
      <div className="flex gap-3 px-4 py-3.5 items-start">
        <div className="flex-1 min-w-0">
          <TypeChip
            category={isQuickNote ? "note" : item.content?.category || "other"}
            time={formatItemTime(item)}
            className="mb-2 h-7 px-2.5 text-[11px]"
          />
          <h3 className="font-display text-[17px] font-semibold leading-snug line-clamp-2">
            {title}
          </h3>
          {meta && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {meta}
            </p>
          )}
        </div>
        {item.content?.thumbnail_url && (
          <img
            src={item.content.thumbnail_url}
            alt=""
            className={cn(
              "relative pointer-events-none size-16 shrink-0 -mt-5 -mr-4 rounded-2xl object-cover border-[3px] border-white shadow-[var(--shadow-lg)]",
              "transition-transform duration-300 ease-out motion-reduce:transition-none",
              index % 2 === 0
                ? "rotate-[5deg] group-hover:rotate-[8deg]"
                : "-rotate-[4deg] group-hover:-rotate-[7deg]"
            )}
          />
        )}
      </div>
    </div>
  );
}
