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
export function isLowValueResult(item: AnalysedItem | null | undefined): boolean {
  if (!item) return true;

  const title = (item.title ?? "").trim().toLowerCase();
  if (!title) return true;
  if (PLACEHOLDER_TITLES.some((p) => title.includes(p))) return true;

  const keys = Object.entries((item.data ?? {}) as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k]) => k);
  if (item.category === "other" && keys.every((k) => k === "description")) {
    return true;
  }

  return false;
}

/** True when a row holds something a user would be upset to lose. */
export function hasSalvageableContent(
  existing: Pick<Content, "status" | "category" | "title" | "data"> | null | undefined
): boolean {
  if (!existing) return false;
  if (existing.status !== "completed") return false;
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
