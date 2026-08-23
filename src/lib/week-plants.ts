import {
  newPlantsAgainst,
  plantKey,
  plantScoreBand,
  readPlants,
  unionPlants,
  type Plant,
  type PlantScoreBand,
} from "@/lib/plants";

/**
 * The weekly plant score (PLA-56) — the union of the plants in a week's meals.
 *
 * The counting rules live in src/lib/plants.ts; this only decides *what goes
 * into* the week. Three choices are worth stating, because each of them is a
 * place the number could quietly become wrong:
 *
 *  - **Only meals.** Plants are extracted from recipes and nothing else, so an
 *    event or a gift idea sitting in the same week contributes nothing and is
 *    not counted against the week either.
 *
 *  - **A repeat is one contributor.** Cooking the same recipe on Monday and
 *    Thursday is one entry in the breakdown, not two identical rows — the union
 *    is unaffected either way, but a duplicated row reads like it added
 *    something the second time.
 *
 *  - **Meals with no plant data are counted separately, not silently.** 19 of
 *    233 recipes came out of the PLA-57 backfill with no attributes, mostly
 *    because the source site blocks scraping. A week holding three of those has
 *    a real score higher than the one shown, and the UI has to be able to say
 *    so — otherwise the number reads as a verdict on the cooking rather than on
 *    what happens to be extracted.
 */

/** The shape this needs off a Content row. Structural so a full `Content` fits. */
interface ScorableContent {
  id: string;
  title: string;
  category?: string;
  data?: unknown;
}

/** The shape this needs off a plan item. Quick notes have no content. */
export interface ScorableItem {
  content?: ScorableContent | null;
}

export interface MealPlantContribution {
  contentId: string;
  title: string;
  /** Every plant the meal contains, whether or not the week already had it. */
  plants: Plant[];
  /**
   * The plants no earlier meal in the week had.
   *
   * Order-dependent by design: the list is walked in plan order, so the meal
   * that first brought garlic gets the credit for it. This is the only per-meal
   * number that adds up to the weekly total, which is why the breakdown leads
   * with it instead of with each meal's own count.
   */
  newPlants: Plant[];
}

export interface WeekPlantSummary {
  /** The week's distinct plants — a union, never a sum. */
  plants: Plant[];
  count: number;
  band: PlantScoreBand;
  /** Meals carrying plant data, in plan order. */
  meals: MealPlantContribution[];
  /** Meals with no plant data. The count is a floor when this is above zero. */
  unscoredMeals: number;
}

function plantsOf(content: ScorableContent): Plant[] {
  const data = content.data as { plants?: unknown } | null | undefined;
  return readPlants(data?.plants);
}

/**
 * Summarize a week's worth of plan items. Pass them in the order they appear
 * in the week — the "new plants" attribution follows that order.
 */
export function summarizeWeekPlants(
  items: readonly ScorableItem[]
): WeekPlantSummary {
  const seenContent = new Set<string>();
  const covered = new Set<string>();
  const lists: Plant[][] = [];
  const meals: MealPlantContribution[] = [];
  let unscoredMeals = 0;

  for (const item of items) {
    const content = item.content;
    if (!content || content.category !== "meal") continue;
    if (seenContent.has(content.id)) continue;
    seenContent.add(content.id);

    const plants = plantsOf(content);
    if (plants.length === 0) {
      unscoredMeals++;
      continue;
    }

    const newPlants = newPlantsAgainst(plants, covered);
    for (const plant of newPlants) covered.add(plantKey(plant.source));

    lists.push(plants);
    meals.push({
      contentId: content.id,
      title: content.title,
      plants,
      newPlants,
    });
  }

  const plants = unionPlants(lists);

  return {
    plants,
    count: plants.length,
    band: plantScoreBand(plants.length),
    meals,
    unscoredMeals,
  };
}
