"use client";

import { categoryUI } from "@/lib/categories";
import { categoryEmoji } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * What kind of item this is, as its emoji — and, on a planner card, when it's
 * planned for.
 *
 * Pressed into the card as information (.surface-inset in globals.css). The
 * card's tint already says the category at a glance; the emoji is the one
 * marker on top of that, so there's no separate type badge or icon.
 *
 * `"note"` stands in for a planner quick note, which has no category.
 */
export function TypeChip({
  category,
  time,
  className,
}: {
  category: string;
  time?: string | null;
  className?: string;
}) {
  const isNote = category === "note";
  const emoji = isNote ? "📝" : categoryEmoji(category);
  const label = isNote ? "Quick note" : categoryUI(category).label;

  return (
    <span
      className={cn(
        "surface-inset inline-flex items-center gap-1 rounded-full font-semibold text-[var(--foreground)]",
        className,
      )}
    >
      <span role="img" aria-label={label} title={label} className="leading-none">
        {emoji}
      </span>
      {time}
    </span>
  );
}
