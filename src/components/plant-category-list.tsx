"use client";

import { plantLabel, plantsByCategory, type Plant } from "@/lib/plants";

/**
 * A plant set, grouped into its six categories.
 *
 * Shared by the item drawer and the week drawer so the two never drift: the
 * whole point of the counting rule is that one recipe's five plants and a
 * week's twenty-six are the same kind of thing, and they stop looking like it
 * the moment the two lists are styled apart.
 */
export function PlantCategoryList({ plants }: { plants: readonly Plant[] }) {
  const groups = plantsByCategory(plants);

  return (
    <>
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
    </>
  );
}
