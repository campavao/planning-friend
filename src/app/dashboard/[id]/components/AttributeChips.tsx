"use client";

import {
  ChefHat,
  Clock,
  DollarSign,
  Flame,
  Leaf,
  MapPin,
  Shapes,
  Ticket,
  CalendarCheck,
} from "lucide-react";
import type { ElementType } from "react";
import { describeAttributes, type AttributeKey } from "@/lib/attributes";
import type { ContentCategory } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * The at-a-glance attributes of a saved item.
 *
 * Chips rather than rows: three full-width rows for three one-word values ate a
 * third of a phone screen, and chips are cheap enough that a fourth or fifth
 * attribute costs almost nothing — which is exactly the property that made them
 * worth extending past recipes (PLA-59).
 *
 * What each category shows lives in `@/lib/attributes`, not here, because the
 * `key` on each attribute is the filter dimension that will replace tags. This
 * file only decides which icon goes with which key.
 *
 * Every chip is optional. An item extracted before these fields existed renders
 * nothing here rather than a row of "Unknown", which would be three lies.
 */

const ICONS: Record<AttributeKey, ElementType> = {
  effort: ChefHat,
  spice: Flame,
  plants: Leaf,
  type: Shapes,
  price: DollarSign,
  prep: Clock,
  ticket: Ticket,
  reservation: CalendarCheck,
  destination: MapPin,
};

const ICON_TONES: Partial<Record<AttributeKey, string>> = {
  effort: "text-[var(--primary)]",
  spice: "text-[#D9534F]",
  plants: "text-[var(--secondary-dark)]",
};

function Chip({
  icon: Icon,
  iconClassName,
  children,
  onClick,
}: {
  icon: ElementType;
  iconClassName: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)]",
    "bg-[var(--card)] px-3 py-1.5 text-[12.5px] font-semibold",
    "shadow-[var(--shadow-sm)]"
  );

  if (!onClick) {
    return (
      <span className={className}>
        <Icon className={cn("w-[15px] h-[15px]", iconClassName)} />
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--background)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      )}
    >
      <Icon className={cn("w-[15px] h-[15px]", iconClassName)} />
      {children}
    </button>
  );
}

interface AttributeChipsProps {
  category: ContentCategory | string;
  data: Record<string, unknown> | null | undefined;
  /** Opens the plant breakdown. Without it the plant chip is not tappable. */
  onShowPlants?: () => void;
}

export function AttributeChips({
  category,
  data,
  onShowPlants,
}: AttributeChipsProps) {
  const attributes = describeAttributes(category, data);

  if (attributes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3.5 pt-1.5">
      {attributes.map((attribute) => (
        <Chip
          key={attribute.key}
          icon={ICONS[attribute.key]}
          iconClassName={ICON_TONES[attribute.key] ?? "text-muted-foreground"}
          onClick={attribute.key === "plants" ? onShowPlants : undefined}
        >
          {attribute.label}
        </Chip>
      ))}
    </div>
  );
}
