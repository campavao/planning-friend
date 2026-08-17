"use client";

import { ActionDrawer } from "@/components/ui/action-drawer";
import {
  WEEKLY_PLANT_GOOD_MIN,
  WEEKLY_PLANT_TARGET,
  plantLabel,
  plantsByCategory,
  type Plant,
} from "@/lib/plants";

/**
 * What the plant count is made of.
 *
 * Deliberately explains rather than scores. The count only means something if
 * you can see which plants it came from — and seeing "soy sauce" listed under
 * both soybean and wheat is what makes the counting rule legible instead of
 * feeling arbitrary.
 */

interface PlantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plants: Plant[];
}

export function PlantDrawer({ open, onOpenChange, plants }: PlantDrawerProps) {
  const groups = plantsByCategory(plants);
  const total = groups.reduce((sum, group) => sum + group.plants.length, 0);

  return (
    <ActionDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`${total} distinct ${total === 1 ? "plant" : "plants"}`}
    >
      <div className="pb-2">
        {groups.map((group) => (
          <div key={group.category} className="px-3.5 pb-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground mb-2">
              {group.label}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {group.plants.map((plant) => (
                <li
                  key={plant.source}
                  className="text-[12.5px] font-medium px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--background)]"
                >
                  {/* The source is the identity; the recipe's own wording is
                      the useful label, so show both when they differ. */}
                  <span className="capitalize">{plant.source}</span>
                  {plant.name && plant.name !== plant.source && (
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {plantLabel(plant)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="px-3.5 pt-2 pb-1 text-[11.5px] leading-relaxed text-muted-foreground border-t border-[var(--border)] mt-1">
          Counted by plant, not by ingredient — so noodles and soy sauce share
          one wheat between them. Eating {WEEKLY_PLANT_GOOD_MIN}–
          {WEEKLY_PLANT_TARGET} different plants across a week is the range
          associated with a more diverse gut microbiome.
        </p>
      </div>
    </ActionDrawer>
  );
}
