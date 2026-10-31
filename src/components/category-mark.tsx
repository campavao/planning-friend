"use client";

import { categoryUI } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

/**
 * A category as just its icon: white, on a disc of the category's colour.
 *
 * For cards whose header is already tinted in that colour: the tint says what
 * kind of thing it is at a glance, so the named pill was saying it twice. The
 * mark keeps the icon — and the name, for screen readers and on hover.
 *
 * The inset shadow is deliberate: the buttons beside it are raised, with drop
 * shadows, and pressing the mark into the card instead keeps it from reading
 * as one more button.
 */
export function CategoryMark({
  category,
  as,
  className,
}: {
  category: string;
  /** Stands in for the category's own look — a planner quick note has no
   *  category, but sits in the same slot. */
  as?: { icon: ElementType; label: string; solid: string };
  className?: string;
}) {
  const { icon: Icon, label, solid } = as ?? categoryUI(category);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
        "shadow-[inset_0_1px_3px_rgba(0,0,0,0.28)]",
        solid,
        className,
      )}
    >
      <Icon className="size-3.5 text-white" aria-hidden />
    </span>
  );
}
