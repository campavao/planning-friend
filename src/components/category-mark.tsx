"use client";

import { categoryUI } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

/**
 * A category as just its icon, in a small white disc.
 *
 * For cards that are already tinted in their category's colour: the tint says
 * what kind of thing it is at a glance, so the named pill was saying it twice.
 * The mark keeps the icon — and the name, for screen readers and on hover —
 * tucked somewhere out of the way.
 */
export function CategoryMark({
  category,
  as,
  className,
}: {
  category: string;
  /** Stands in for the category's own look — a planner quick note has no
   *  category, but sits in the same slot. */
  as?: { icon: ElementType; label: string; text: string };
  className?: string;
}) {
  const { icon: Icon, label, text } = as ?? categoryUI(category);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <Icon className={cn("size-3.5", text)} aria-hidden />
    </span>
  );
}
