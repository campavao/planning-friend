/**
 * Plant diversity — the model behind the health score (PLA-56/57/58).
 *
 * The score is not a verdict on whether a meal is "healthy". It counts how many
 * *distinct plants* a week of cooking contains, against the 20–30 range the
 * Hack Your Health documentary calls good. Two rules do all the work:
 *
 *  1. A plant is identified by its **source organism**, not by the ingredient
 *     string. Egg noodles, bread and plain flour all resolve to wheat and count
 *     once between them; soy sauce resolves to *two* plants, soybean and wheat.
 *     Storing the source is what makes the weekly union correct by construction
 *     instead of correct only if the extraction happened to phrase things the
 *     same way twice.
 *
 *  2. The weekly total is a **set union, not a sum**. Garlic in three meals is
 *     one plant. This is why an item stores a list rather than a number: with
 *     only a count per item there is no way to add two items together without
 *     double-counting, and no way to answer "what would this add that I don't
 *     already have?" — which is the whole of PLA-58.
 *
 * Herbs and spices are deliberately excluded. The dietitian guide behind PLA-56
 * lists six groups and leaves them out, and counting them would let a
 * well-stocked spice rack carry a third of the weekly target without a
 * vegetable in sight.
 */

/** The six groups that count. No herbs/spices — see the note above. */
export const PLANT_CATEGORIES = [
  "vegetable",
  "fruit",
  "whole_grain",
  "legume",
  "nut",
  "seed",
] as const;

export type PlantCategory = (typeof PLANT_CATEGORIES)[number];

/** Display order and labels for the weekly breakdown. */
export const PLANT_CATEGORY_LABELS: Record<PlantCategory, string> = {
  vegetable: "Vegetables",
  fruit: "Fruits",
  whole_grain: "Whole grains",
  legume: "Legumes",
  nut: "Nuts",
  seed: "Seeds",
};

/**
 * One plant contributed by a recipe.
 *
 * `source` is the identity — the organism the ingredient came from. `name` is
 * only ever for display, so "egg noodles" can still be shown to the cook while
 * the set dedupes on "wheat".
 */
export interface Plant {
  /** The organism. Lowercase, singular. This is the dedupe key. */
  source: string;
  /** What the recipe actually called it. Falls back to `source` when absent. */
  name?: string;
  category: PlantCategory;
}

/** The range the documentary describes as good, and the headline target. */
export const WEEKLY_PLANT_GOOD_MIN = 20;
export const WEEKLY_PLANT_TARGET = 30;

/**
 * The dedupe key for a plant.
 *
 * Case and surrounding whitespace are noise, and a trailing plural is the one
 * inflection the extraction reliably varies on ("lentil" vs "lentils"), so it
 * is stripped. Nothing cleverer is attempted: real synonym collapsing is the
 * extraction's job, because it is the only part of the system that knows egg
 * noodles are wheat.
 */
export function plantKey(source: string): string {
  const trimmed = source.trim().toLowerCase();
  // "es" first so "tomatoes" doesn't become "tomatoe".
  if (trimmed.endsWith("es") && trimmed.length > 3) return trimmed.slice(0, -2);
  if (trimmed.endsWith("s") && !trimmed.endsWith("ss") && trimmed.length > 2) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function isPlantCategory(value: unknown): value is PlantCategory {
  return (
    typeof value === "string" &&
    (PLANT_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Read a plant list out of a raw `data` blob.
 *
 * Anything malformed is dropped rather than throwing: this runs against rows
 * written by older extractions and by hand, and one bad entry must not take the
 * whole item's score with it.
 */
export function readPlants(value: unknown): Plant[] {
  if (!Array.isArray(value)) return [];

  const out: Plant[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

    const record = entry as Record<string, unknown>;
    const source = typeof record.source === "string" ? record.source.trim() : "";
    if (!source) continue;
    if (!isPlantCategory(record.category)) continue;

    const name = typeof record.name === "string" ? record.name.trim() : "";
    out.push({
      source,
      category: record.category,
      ...(name && name !== source ? { name } : {}),
    });
  }

  return dedupePlants(out);
}

/**
 * Collapse a list to one entry per source, keeping the first occurrence.
 *
 * First-wins rather than last-wins so the display name a recipe led with is the
 * one that survives — if a recipe lists "soy sauce" before "egg noodles", the
 * shared wheat is more usefully labelled by whichever came first than by
 * whichever happened to be parsed last.
 */
export function dedupePlants(plants: readonly Plant[]): Plant[] {
  const seen = new Set<string>();
  const out: Plant[] = [];

  for (const plant of plants) {
    const key = plantKey(plant.source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(plant);
  }

  return out;
}

/** How many distinct plants one item contributes. */
export function countPlants(plants: readonly Plant[]): number {
  return dedupePlants(plants).length;
}

/**
 * The union across many items — the weekly score.
 *
 * Takes lists rather than counts precisely because summing counts would
 * double-count anything two recipes share.
 */
export function unionPlants(lists: readonly (readonly Plant[])[]): Plant[] {
  return dedupePlants(lists.flat());
}

/** The set of keys already present, for comparing a candidate against a week. */
export function plantKeySet(plants: readonly Plant[]): Set<string> {
  return new Set(plants.map((plant) => plantKey(plant.source)));
}

/**
 * The plants an item would add to a week that already contains `existing`.
 *
 * This is what the suggestion engine ranks on (PLA-58): "adds 5 you don't have"
 * is a far better reason to cook something than "scores 7", and it is only
 * answerable because items carry lists.
 */
export function newPlantsAgainst(
  candidate: readonly Plant[],
  existing: Set<string>
): Plant[] {
  return dedupePlants(candidate).filter(
    (plant) => !existing.has(plantKey(plant.source))
  );
}

/** Per-category counts, in display order, for the weekly breakdown. */
export function plantsByCategory(
  plants: readonly Plant[]
): { category: PlantCategory; label: string; plants: Plant[] }[] {
  const deduped = dedupePlants(plants);

  return PLANT_CATEGORIES.map((category) => ({
    category,
    label: PLANT_CATEGORY_LABELS[category],
    plants: deduped.filter((plant) => plant.category === category),
  })).filter((group) => group.plants.length > 0);
}

/** What to show for a plant: what the recipe called it, else the organism. */
export function plantLabel(plant: Plant): string {
  return plant.name || plant.source;
}
