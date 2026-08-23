"use client";

import { ActionDrawer } from "@/components/ui/action-drawer";
import { PlantCategoryList } from "@/components/plant-category-list";
import {
  WEEKLY_PLANT_GOOD_MIN,
  WEEKLY_PLANT_TARGET,
  countPlants,
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
  const total = countPlants(plants);

  return (
    <ActionDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`${total} distinct ${total === 1 ? "plant" : "plants"}`}
    >
      <div className="pb-2">
        <PlantCategoryList plants={plants} />

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
