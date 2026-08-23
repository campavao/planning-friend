import type { DecayedHistory } from "@/lib/db/planner";
import type { ContentWithTags } from "@/lib/db/types";
import { rankForDay, type ScoredCandidate } from "./scorer";
import { plantKeySet, readPlants, unionPlants } from "@/lib/plants";

/** Monday-first, matching `mondayIndexOf` and the planner grid. */
export const WEEK_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

/**
 * How many planned items make a day "full" enough to stop suggesting into.
 *
 * The old rule was "any item at all", which is why a day holding a single
 * lunch went silent for the rest of the week. A day in this app usually has
 * room for one main thing plus something small, so one entry is not a plan —
 * it is a day with a gap next to it, and that is exactly when a suggestion is
 * useful. At two entries the day has a shape of its own and further picks read
 * as clutter, so that is where we stop. Deliberately a count, not a
 * category-aware rule: we have no reliable meal/slot model yet, and a wrong
 * "your day is booked" judgement is more annoying than one extra suggestion.
 */
export const DAY_FULL_THRESHOLD = 2;

/**
 * A day ranking below this is thin enough to be worth a second, relaxed pass.
 * Matches the number of picks the strip shows, so "thin" means "cannot even
 * fill the strip".
 */
export const MIN_CANDIDATES_PER_DAY = 3;

export type DayCoverageStatus =
  /** Ranked at least one candidate. */
  | "picks"
  /** Skipped: the day already holds DAY_FULL_THRESHOLD or more items. */
  | "day_full"
  /** Ranked nothing — the pool was emptied by the filters below. */
  | "no_candidates";

export interface DayDiagnostics {
  dayIndex: number;
  plannedCount: number;
  poolSize: number;
  filteredDismissed: number;
  /** Dropped because they are already planned (this week, or this day on a relaxed pass). */
  filteredPlanned: number;
  eligibleCount: number;
  rankedCount: number;
  /** True when the week-wide "already planned" filter had to be narrowed to this day. */
  relaxed: boolean;
  status: DayCoverageStatus;
}

export interface WeekItemRef {
  plannedDate: string;
  contentId?: string | null;
  category?: string | null;
  title?: string | null;
}

export interface WeekSummary {
  plannedCountByDay: Record<number, number>;
  plannedIdsByDay: Record<number, Set<string>>;
  /** Every content id planned anywhere in the visible week. */
  thisWeekContentIds: Set<string>;
  /** Titles + categories for the curator prompt. */
  alreadyPlanned: Array<{ dayIndex: number; title: string; category: string }>;
}

/** Monday = 0 ... Sunday = 6, or null when the date is unparseable. */
export function mondayIndexOf(value: string): number | null {
  const planned = new Date(value);
  if (Number.isNaN(planned.getTime())) return null;
  return (planned.getUTCDay() + 6) % 7;
}

export function isDayFull(plannedCount: number): boolean {
  return plannedCount >= DAY_FULL_THRESHOLD;
}

export function summariseWeekItems(items: WeekItemRef[]): WeekSummary {
  const plannedCountByDay: Record<number, number> = {};
  const plannedIdsByDay: Record<number, Set<string>> = {};
  for (const day of WEEK_DAY_INDEXES) {
    plannedCountByDay[day] = 0;
    plannedIdsByDay[day] = new Set();
  }

  const thisWeekContentIds = new Set<string>();
  const alreadyPlanned: WeekSummary["alreadyPlanned"] = [];

  for (const item of items) {
    const day = mondayIndexOf(item.plannedDate);
    if (day === null) continue;
    plannedCountByDay[day] += 1;
    if (item.contentId) {
      plannedIdsByDay[day].add(item.contentId);
      thisWeekContentIds.add(item.contentId);
    }
    if (item.title && item.category) {
      alreadyPlanned.push({
        dayIndex: day,
        title: item.title,
        category: item.category,
      });
    }
  }

  return {
    plannedCountByDay,
    plannedIdsByDay,
    thisWeekContentIds,
    alreadyPlanned,
  };
}

export interface PlanWeekArgs {
  pool: ContentWithTags[];
  history: DecayedHistory;
  summary: WeekSummary;
  dismissedByDay: Record<number, string[]>;
  weekStart: string;
  now: Date;
  /** Defaults to the whole week; a single-day refresh passes just that day. */
  targetDays?: number[];
  topN?: number;
}

export interface WeekCoverage {
  /**
   * Keyed by every day in `targetDays` — a day that ranked nothing maps to an
   * empty array rather than going missing, so downstream can tell "we looked
   * and found nothing" apart from "we never looked".
   */
  candidatesByDay: Record<number, ScoredCandidate[]>;
  diagnostics: DayDiagnostics[];
}

/**
 * The whole day-coverage decision in one pure function: given a pool, what is
 * already planned, and what has been dismissed, decide which days get
 * candidates and record why for the ones that do not.
 */
export function planWeekCoverage(args: PlanWeekArgs): WeekCoverage {
  const {
    pool,
    history,
    summary,
    dismissedByDay,
    weekStart,
    now,
    targetDays = WEEK_DAY_INDEXES,
    topN = 8,
  } = args;

  const candidatesByDay: Record<number, ScoredCandidate[]> = {};
  const diagnostics: DayDiagnostics[] = [];

  // The plants this week already has, from the library rows behind the planned
  // items. Computed once from the whole week rather than per pass: the relaxed
  // retry narrows which items are *excluded*, but the week's diversity is the
  // same either way, and recomputing it from the narrowed set would tell a day
  // it needed plants it already had.
  //
  // A planned item that is not in the pool — a friend's shared item — is simply
  // not counted. That understates the week, which biases toward suggesting more
  // diversity rather than less, and is the safer way to be wrong.
  const weekPlantKeys = plantKeySet(
    unionPlants(
      pool
        .filter((c) => summary.thisWeekContentIds.has(c.id))
        .map((c) => readPlants((c.data as { plants?: unknown } | null)?.plants))
    )
  );

  for (const day of targetDays) {
    const plannedCount = summary.plannedCountByDay[day] ?? 0;

    if (isDayFull(plannedCount)) {
      candidatesByDay[day] = [];
      diagnostics.push({
        dayIndex: day,
        plannedCount,
        poolSize: pool.length,
        filteredDismissed: 0,
        filteredPlanned: 0,
        eligibleCount: 0,
        rankedCount: 0,
        relaxed: false,
        status: "day_full",
      });
      continue;
    }

    const dismissedIds = new Set(dismissedByDay[day] ?? []);
    let result = rankForDay({
      pool,
      history,
      excludedContentIds: summary.thisWeekContentIds,
      dismissedIds,
      weekPlantKeys,
      dayIndex: day,
      weekStart,
      now,
      topN,
    });

    // Excluding everything planned anywhere this week keeps the week varied,
    // but on a small library it can starve a day completely. When that happens
    // we fall back to the narrower rule — never re-suggest what is already on
    // *this* day — rather than showing the user nothing at all.
    const sameDayIds = summary.plannedIdsByDay[day] ?? new Set<string>();
    let relaxed = false;
    if (
      result.candidates.length < MIN_CANDIDATES_PER_DAY &&
      summary.thisWeekContentIds.size > sameDayIds.size
    ) {
      const relaxedResult = rankForDay({
        pool,
        history,
        excludedContentIds: sameDayIds,
        dismissedIds,
        weekPlantKeys,
        dayIndex: day,
        weekStart,
        now,
        topN,
      });
      if (relaxedResult.candidates.length > result.candidates.length) {
        result = relaxedResult;
        relaxed = true;
      }
    }

    candidatesByDay[day] = result.candidates;
    diagnostics.push({
      dayIndex: day,
      plannedCount,
      poolSize: result.poolSize,
      filteredDismissed: result.filteredDismissed,
      filteredPlanned: result.filteredPlanned,
      eligibleCount: result.eligibleCount,
      rankedCount: result.candidates.length,
      relaxed,
      status: result.candidates.length > 0 ? "picks" : "no_candidates",
    });
  }

  return { candidatesByDay, diagnostics };
}
