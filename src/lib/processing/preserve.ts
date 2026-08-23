import { SOURCE_MESSAGE_KEY } from "@/lib/constants";
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
  // Not extracted at all — it is the message the owner texted in, kept so a
  // re-process has the context the first one had.
  SOURCE_MESSAGE_KEY,
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
 * How much content a result carries. Arrays count by length, so 21 ingredients
 * outweigh a single one; trivia is ignored, as everywhere else here.
 */
export function contentWeight(data: unknown): number {
  let weight = 0;
  for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) {
    if (TRIVIAL_KEYS.has(k)) continue;
    if (Array.isArray(v)) weight += v.length;
    else if (v !== null && v !== undefined && v !== "") weight += 1;
  }
  return weight;
}

/**
 * A re-extraction can fail without coming back empty. One real case: a recipe
 * holding 21 ingredients and 26 steps came back as three "ingredients" that
 * were the words of its own title, and nothing else. isLowValueResult passes
 * that happily, because three is more than none.
 *
 * Below this many items in the existing row, a shrink is ordinary variance and
 * gets no special treatment — extractions of a six-line recipe legitimately
 * differ by a line or two.
 */
const COLLAPSE_FLOOR = 8;

/** True when the incoming result is a fraction of what the row already holds. */
export function isCollapse(existingData: unknown, incoming: AnalysedItem | null | undefined): boolean {
  const before = contentWeight(existingData);
  if (before < COLLAPSE_FLOOR) return false;
  return contentWeight(incoming?.data) * 2 < before;
}

/** The place an item is, if it has one. */
function locationOf(data: unknown): string {
  const value = (data as Record<string, unknown> | null | undefined)?.location;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * True when the re-analysis has lost the location the row already had.
 *
 * `isCollapse` cannot see this one: it does nothing below a weight of eight,
 * and a saved booking — a place, a couple of dates, a link — sits well under
 * that. So a photo of a hotel receipt that re-read as a bare description passed
 * every check and overwrote the address.
 *
 * Not a blanket "never lose a field". The incoming result has to be no richer
 * overall, so a re-extraction that genuinely found more still lands, and only a
 * strictly poorer one is turned away.
 */
export function losesLocation(
  existingData: unknown,
  incoming: AnalysedItem | null | undefined
): boolean {
  if (!locationOf(existingData)) return false;
  if (locationOf(incoming?.data)) return false;
  return contentWeight(incoming?.data) <= contentWeight(existingData);
}

/** Nothing worth keeping: the key may as well not be there. */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Owner-typed sections come first and win on label, because a person put them
 *  there deliberately and an extraction only ever guessed. */
function mergeSections(existing: unknown, incoming: unknown): unknown {
  const kept = Array.isArray(existing) ? existing : [];
  const found = Array.isArray(incoming) ? incoming : [];
  if (kept.length === 0) return found.length > 0 ? found : undefined;

  const labels = new Set(
    kept.map((s) =>
      String((s as { label?: unknown })?.label ?? "").trim().toLowerCase()
    )
  );
  const additions = found.filter((s) => {
    const label = String((s as { label?: unknown })?.label ?? "")
      .trim()
      .toLowerCase();
    return label && !labels.has(label);
  });
  return [...kept, ...additions].slice(0, MAX_MERGED_SECTIONS);
}

/** Matches the cap the PATCH schema enforces, so a merge can never build a
 *  blob the editor would then refuse to save. */
const MAX_MERGED_SECTIONS = 20;

/**
 * Fold a re-analysis into what the row already holds.
 *
 * A re-extraction is supposed to improve an item, and it usually does — but it
 * is a fresh read of the source, not a diff, so a field it happens not to find
 * this time comes back absent. Writing that over the row turns "I did not see a
 * price" into "there is no price". A saved TikTok find lost its cost exactly
 * that way: everything else re-read fine, so no guard fired, and the number
 * simply stopped existing.
 *
 * So: the new result wins wherever it says something, and the old value fills
 * the gaps where it does not. That also rescues two things nothing else was
 * protecting — the sections the owner typed themselves, and the
 * `manually_edited_at` stamp, both of which a regenerate used to erase.
 *
 * Skipped entirely when the category changed. The old fields describe a
 * different kind of thing at that point, and an event's `date` has no business
 * surviving onto a meal.
 */
export function mergeOntoExisting(
  existing: Pick<Content, "category" | "data"> | null | undefined,
  incoming: AnalysedItem
): Record<string, unknown> {
  const incomingData = (incoming.data ?? {}) as Record<string, unknown>;
  if (!existing?.data || typeof existing.data !== "object") return incomingData;
  if (existing.category !== incoming.category) return incomingData;

  const existingData = existing.data as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...incomingData };

  for (const [key, value] of Object.entries(existingData)) {
    if (isEmptyValue(value)) continue;
    if (key === "sections") continue;
    if (isEmptyValue(merged[key])) merged[key] = value;
  }

  const sections = mergeSections(existingData.sections, incomingData.sections);
  if (sections === undefined) delete merged.sections;
  else merged.sections = sections;

  return merged;
}

/**
 * The decision itself: keep what is already there when the incoming result is
 * empty, when it is a collapsed fraction of what the row already holds, or when
 * it has dropped the row's location without making up for it elsewhere.
 *
 * Deliberately NOT covered: a re-analysis that succeeds but classifies the item
 * differently. That is a genuine extraction, not a failure, and blocking it
 * would freeze every mis-categorised item in place forever.
 */
export function shouldPreserveExisting(
  existing: Pick<Content, "status" | "category" | "title" | "data"> | null | undefined,
  incoming: AnalysedItem | null | undefined
): boolean {
  if (!hasSalvageableContent(existing)) return false;
  return (
    isLowValueResult(incoming) ||
    isCollapse(existing?.data, incoming) ||
    losesLocation(existing?.data, incoming)
  );
}
