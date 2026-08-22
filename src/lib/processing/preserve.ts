import type { Content } from "@/lib/db/types";

/**
 * Guards an already-saved item against being overwritten by a failed
 * re-analysis.
 *
 * The failure mode this exists for: when Gemini errors, `analyzeWithThumbnail`
 * does not throw and does not mark anything failed — it returns a perfectly
 * well-formed result whose title is "Unable to analyze content" and whose
 * category is "other". The processors then write that over the row as a
 * completed item. A recipe saved months ago becomes a placeholder, and the
 * original title, ingredients and steps are gone.
 *
 * That is survivable for a first-time save (there was nothing there yet). It is
 * not survivable for a re-process, which is how a bulk backfill destroyed three
 * items before this guard existed.
 */

/** Titles the pipeline invents when it could not read the source. */
const PLACEHOLDER_TITLES = [
  "unable to analyze content",
  "unable to analyze video",
  "undetermined content",
  "analysis returned no results",
  "no image found",
  "failed to process image",
];

export interface AnalysedItem {
  category?: string;
  title?: string;
  /**
   * Loose on purpose: callers pass the category-specific shapes (MealData,
   * EventData, ...) which have no index signature, and this only ever reads
   * which keys are populated.
   */
  data?: unknown;
}

/**
 * True when a result carries no more information than "I couldn't read it".
 *
 * Two shapes qualify: one of the known placeholder titles, or the shrug Gemini
 * returns when it parses the source but finds nothing in it — category "other"
 * carrying a description and nothing else.
 */
/**
 * Fields a model can fill in convincingly without having read anything.
 *
 * A drink that comes back as `{type: "cocktail", description: "A recipe for a
 * classic Gin Sour, typically found on liquor.com"}` has both of the first two
 * and no recipe — inferred from the URL. A retry of that same item then
 * returned empty ingredient, recipe and equipment arrays alongside a populated
 * prep_time and difficulty, which is how the timings and ratings ended up here
 * too: guessing "5 minutes, easy" for a cocktail needs no source at all.
 *
 * What is left — ingredients, steps, equipment, location, sections — cannot be
 * produced without actually reading the source.
 */
const TRIVIAL_KEYS = new Set([
  "description",
  "type",
  "prep_time",
  "cook_time",
  "servings",
  "difficulty",
  "effort",
  "spice",
]);

/** How many fields the result carries that represent real extracted content. */
function substanceOf(data: unknown): number {
  return Object.entries((data ?? {}) as Record<string, unknown>).filter(
    ([k, v]) =>
      !TRIVIAL_KEYS.has(k) &&
      v !== null &&
      v !== undefined &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0)
  ).length;
}

export function isLowValueResult(item: AnalysedItem | null | undefined): boolean {
  if (!item) return true;

  const title = (item.title ?? "").trim().toLowerCase();
  if (!title) return true;
  if (PLACEHOLDER_TITLES.some((p) => title.includes(p))) return true;

  // Substance, not category. The first version of this checked for category
  // "other" carrying only a description, which missed the commoner failure:
  // a scrape fails, and the model returns a confident, correctly-categorised,
  // completely empty result. That overwrote a real cocktail recipe.
  return substanceOf(item.data) === 0;
}

/**
 * True when a row holds something a user would be upset to lose.
 *
 * Deliberately does NOT look at status. The first version required
 * "completed", which made the whole guard inert: the reprocess route flips the
 * row to "processing" before dispatching, so by the time a processor reads it
 * back the status is never "completed" and this always returned false. The
 * guard silently protected nothing through five batches.
 *
 * Content is the only thing worth testing. A row mid-first-ingest has none, so
 * it needs no status check to stay unprotected.
 */
export function hasSalvageableContent(
  existing: Pick<Content, "status" | "category" | "title" | "data"> | null | undefined
): boolean {
  if (!existing) return false;
  return !isLowValueResult({
    category: existing.category,
    title: existing.title,
    data: existing.data,
  });
}

/**
 * The decision itself: keep what is already there when the incoming result is
 * a placeholder and the existing row is real.
 *
 * Deliberately NOT covered: a re-analysis that succeeds but classifies the item
 * differently. That is a genuine extraction, not a failure, and blocking it
 * would freeze every mis-categorised item in place forever.
 */
export function shouldPreserveExisting(
  existing: Pick<Content, "status" | "category" | "title" | "data"> | null | undefined,
  incoming: AnalysedItem | null | undefined
): boolean {
  return hasSalvageableContent(existing) && isLowValueResult(incoming);
}
