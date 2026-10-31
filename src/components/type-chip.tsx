"use client";

import { categoryUI } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

/** A planner quick note has no category; it borrows this look instead. */
const NOTE_UI = { icon: FileText, label: "Quick note" };

/**
 * What kind of item this is, as its category icon — and, on a planner card,
 * when it's planned for.
 *
 * Pressed into the card as information (.surface-inset in globals.css). The
 * card's tint already says the category at a glance; the icon is the one
 * marker on top of that, so there's no separate type badge.
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
  const { icon: Icon, label } =
    category === "note" ? NOTE_UI : categoryUI(category);

  return (
    <span
      className={cn(
        "surface-inset inline-flex items-center gap-1 rounded-full font-semibold text-[var(--foreground)]",
        className,
      )}
    >
      <Icon
        role="img"
        aria-label={label}
        // The foreground colour, like the time beside it: the card's tint
        // already carries the category colour.
        className="size-3.5 shrink-0"
      >
        <title>{label}</title>
      </Icon>
      {time}
    </span>
  );
}
