"use client";

import { Leaf } from "lucide-react";
import { useState } from "react";
import { ActionDrawer } from "@/components/ui/action-drawer";
import { PlantCategoryList } from "@/components/plant-category-list";
import {
  WEEKLY_PLANT_GOOD_MIN,
  WEEKLY_PLANT_TARGET,
  type PlantScoreBand,
} from "@/lib/plants";
import { cn } from "@/lib/utils";
import type { WeekPlantSummary } from "@/lib/week-plants";

/**
 * The week's plant score (PLA-56): a chip in the week header, and the
 * breakdown behind it.
 *
 * The chip is a number and nothing else — no ring, no percentage, no verdict.
 * The score is a count against a range, and a dial implies a precision the
 * "20–30 is considered good" claim does not have. The colour carries the only
 * judgement worth making at a glance, and everything that explains the number
 * lives in the drawer, where there is room to be honest about it.
 */

const BAND_CHIP: Record<PlantScoreBand, string> = {
  building: "bg-[var(--muted)] text-[var(--foreground)]",
  good: "bg-[var(--meal-bg)] text-[var(--secondary-dark)]",
  target: "bg-[var(--secondary)] text-white",
};

const BAND_LEAF: Record<PlantScoreBand, string> = {
  building: "text-muted-foreground",
  good: "text-[var(--secondary-dark)]",
  target: "text-white",
};

function bandMessage(band: PlantScoreBand): string {
  switch (band) {
    case "target":
      return `Past ${WEEKLY_PLANT_TARGET} distinct plants for the week.`;
    case "good":
      return `Inside the ${WEEKLY_PLANT_GOOD_MIN}–${WEEKLY_PLANT_TARGET} range associated with a more diverse gut microbiome.`;
    default:
      return `${WEEKLY_PLANT_GOOD_MIN}–${WEEKLY_PLANT_TARGET} distinct plants across a week is the range associated with a more diverse gut microbiome.`;
  }
}

interface WeekPlantScoreProps {
  summary: WeekPlantSummary;
  /** Shown in the drawer title so the week is unambiguous once it is open. */
  weekRangeLabel: string;
  className?: string;
}

export function WeekPlantScore({
  summary,
  weekRangeLabel,
  className,
}: WeekPlantScoreProps) {
  const [open, setOpen] = useState(false);
  const { count, band, meals, unscoredMeals } = summary;

  // The bar is drawn against the top of the range, so a week past 30 fills it
  // rather than overflowing — being at 34 is not four-elevenths better than 30.
  const fillPercent = Math.min(100, (count / WEEKLY_PLANT_TARGET) * 100);
  const goodMarkPercent = (WEEKLY_PLANT_GOOD_MIN / WEEKLY_PLANT_TARGET) * 100;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${count} distinct plants planned this week. Show the breakdown.`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
          "text-xs font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          BAND_CHIP[band],
          className
        )}
      >
        <Leaf className={cn("w-3 h-3", BAND_LEAF[band])} />
        {count} {count === 1 ? "plant" : "plants"}
      </button>

      <ActionDrawer
        open={open}
        onOpenChange={setOpen}
        title={`${count} distinct ${count === 1 ? "plant" : "plants"} · ${weekRangeLabel}`}
      >
        <div className="pb-2">
          <div className="px-3.5 pb-4">
            <div className="relative h-2 rounded-full bg-[var(--muted)] overflow-hidden">
              {/* The good range, so the bar shows a band and not a pass mark. */}
              <div
                className="absolute inset-y-0 right-0 bg-[var(--secondary-light)]"
                style={{ left: `${goodMarkPercent}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--secondary-dark)]"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              {bandMessage(band)}
            </p>
          </div>

          {count > 0 && <PlantCategoryList plants={summary.plants} />}

          {meals.length > 0 && (
            <div className="px-3.5 pt-1 pb-3 border-t border-[var(--border)] mt-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground mb-2 pt-2">
                What each meal added
              </p>
              <ul className="flex flex-col gap-1">
                {meals.map((meal) => (
                  <li
                    key={meal.contentId}
                    className="flex items-baseline justify-between gap-3 text-[12.5px]"
                  >
                    <span className="font-medium truncate">{meal.title}</span>
                    {/* New plants, not the meal's own count: these are the
                        numbers that add up to the score above. A meal that
                        repeats what the week already has genuinely added
                        nothing to the diversity, and should read that way. */}
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        meal.newPlants.length === 0
                          ? "text-muted-foreground"
                          : "text-[var(--secondary-dark)]"
                      )}
                    >
                      {meal.newPlants.length === 0
                        ? "already covered"
                        : `+${meal.newPlants.length}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="px-3.5 pt-2 pb-1 text-[11.5px] leading-relaxed text-muted-foreground border-t border-[var(--border)] mt-1">
            Counted by plant, not by ingredient — garlic in three meals is one
            plant, and noodles and soy sauce share one wheat between them. Herbs
            and spices do not count.
            {unscoredMeals > 0 && (
              <>
                {" "}
                {unscoredMeals} {unscoredMeals === 1 ? "meal" : "meals"} this
                week {unscoredMeals === 1 ? "has" : "have"} no plant data yet,
                so the real number is higher than {count}.
              </>
            )}
          </p>
        </div>
      </ActionDrawer>
    </>
  );
}
