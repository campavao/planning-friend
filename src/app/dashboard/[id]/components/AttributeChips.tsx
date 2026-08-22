"use client";

import { ChefHat, Flame, Leaf } from "lucide-react";
import type { ElementType } from "react";
import type { MealData, RecipeEffort, SpiceLevel } from "@/lib/supabase";
import { countPlants, readPlants } from "@/lib/plants";
import { cn } from "@/lib/utils";

/**
 * The at-a-glance attributes of a recipe.
 *
 * Chips rather than rows: three full-width rows for three one-word values ate a
 * third of a phone screen, and chips are cheap enough that a fourth or fifth
 * attribute costs almost nothing — which is what makes the pattern worth
 * carrying to other item types later (PLA-59).
 *
 * Every chip is optional. An item extracted before these fields existed renders
 * nothing here rather than a row of "Unknown", which would be three lies.
 */

const EFFORT_LABELS: Record<RecipeEffort, string> = {
  easy: "Easy",
  medium: "Some effort",
  hard: "Involved",
};

const SPICE_LABELS: Record<SpiceLevel, string> = {
  none: "Not spicy",
  mild: "Mild",
  medium: "Medium",
  hot: "Hot",
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
  data: MealData;
  /** Opens the plant breakdown. Without it the plant chip is not tappable. */
  onShowPlants?: () => void;
}

export function AttributeChips({ data, onShowPlants }: AttributeChipsProps) {
  const effort = data.effort ? EFFORT_LABELS[data.effort] : null;
  const spice = data.spice ? SPICE_LABELS[data.spice] : null;
  const plantCount = countPlants(readPlants(data.plants));

  if (!effort && !spice && plantCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3.5 pt-1.5">
      {effort && (
        <Chip icon={ChefHat} iconClassName="text-[var(--primary)]">
          {effort}
        </Chip>
      )}
      {spice && (
        <Chip icon={Flame} iconClassName="text-[#D9534F]">
          {spice}
        </Chip>
      )}
      {plantCount > 0 && (
        <Chip
          icon={Leaf}
          iconClassName="text-[var(--secondary-dark)]"
          onClick={onShowPlants}
        >
          {plantCount} {plantCount === 1 ? "plant" : "plants"}
        </Chip>
      )}
    </div>
  );
}
