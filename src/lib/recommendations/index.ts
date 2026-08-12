import {
  getDecayedHistory,
  getEligibleContentPool,
  type DecayedHistory,
} from "@/lib/db/planner";
import {
  getCached,
  upsertCache,
  type CandidatePool,
  type DismissalMap,
  type SuggestionPayload,
} from "@/lib/db/suggestions";
import type { ScoredCandidate } from "./scorer";
import {
  WEEK_DAY_INDEXES,
  planWeekCoverage,
  summariseWeekItems,
  type DayDiagnostics,
  type WeekItemRef,
} from "./coverage";
import { curate } from "./curator";

const ELIGIBLE_POOL_THRESHOLD = 3;

export interface SuggestionsResult {
  payload: SuggestionPayload;
  candidatePool: CandidatePool;
  dismissed: DismissalMap;
  emptyPool: boolean;
  poolSize: number;
  source: "cache" | "ai" | "fallback";
}

export type ThisWeekItemRef = WeekItemRef;

export interface ComputeArgs {
  userId: string;
  weekStart: string;
  thisWeekItems: ThisWeekItemRef[];
  force?: boolean;
  onlyDayIndex?: number;
  curatorEnabled?: boolean;
  now?: Date;
}

function buildPatternProfile(history: DecayedHistory) {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals: Record<number, Record<string, number>> = {};
  for (let d = 0; d < 7; d++) totals[d] = {};
  for (const it of history.items) {
    totals[it.dayIndex][it.category] =
      (totals[it.dayIndex][it.category] ?? 0) + it.weight;
  }
  const parts: string[] = [];
  for (let d = 0; d < 7; d++) {
    const cats = Object.entries(totals[d])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([c]) => c);
    if (cats.length > 0) parts.push(`${dayLabels[d]}=${cats.join("+")}`);
  }
  return parts.length > 0 ? parts.join(", ") : "no clear pattern yet";
}

/**
 * A day with no picks is a real answer, not a missing one, so every targeted
 * day gets a key. Callers merge their picks over this so the payload always
 * covers the visible week.
 */
function emptyDaysPayload(days: number[]): SuggestionPayload {
  const out: SuggestionPayload = {};
  for (const day of days) out[day] = [];
  return out;
}

function payloadFromCandidates(
  candidatesByDay: Record<number, ScoredCandidate[]>,
  topPerDay: number
): SuggestionPayload {
  const out: SuggestionPayload = {};
  for (const [dayStr, list] of Object.entries(candidatesByDay)) {
    const day = Number(dayStr);
    out[day] = list.slice(0, topPerDay).map((c) => ({
      contentId: c.content.id,
      why: null,
    }));
  }
  return out;
}

function poolFromCandidates(
  candidatesByDay: Record<number, ScoredCandidate[]>
): CandidatePool {
  const out: CandidatePool = {};
  for (const [dayStr, list] of Object.entries(candidatesByDay)) {
    out[Number(dayStr)] = list.map((c) => c.content.id);
  }
  return out;
}

/**
 * One line per computation, carrying the arithmetic for every day we looked
 * at. "Why was Thursday empty?" should be answerable by reading this back,
 * not by re-deriving the run.
 */
function logCoverage(args: {
  userId: string;
  weekStart: string;
  source: string;
  poolSize: number;
  emptyPool: boolean;
  diagnostics: DayDiagnostics[];
}) {
  console.log(
    "[suggestions] coverage",
    JSON.stringify({
      userId: args.userId,
      weekStart: args.weekStart,
      source: args.source,
      poolSize: args.poolSize,
      emptyPool: args.emptyPool,
      days: args.diagnostics.map((d) => ({
        day: d.dayIndex,
        status: d.status,
        planned: d.plannedCount,
        pool: d.poolSize,
        dismissed: d.filteredDismissed,
        alreadyPlanned: d.filteredPlanned,
        eligible: d.eligibleCount,
        ranked: d.rankedCount,
        relaxed: d.relaxed,
      })),
    })
  );
}

export async function getOrComputeSuggestions(
  args: ComputeArgs
): Promise<SuggestionsResult> {
  const now = args.now ?? new Date();
  const targetDays =
    args.onlyDayIndex !== undefined ? [args.onlyDayIndex] : WEEK_DAY_INDEXES;

  if (!args.force) {
    const cached = await getCached(args.userId, args.weekStart, now);
    if (cached) {
      return {
        payload: cached.payload,
        candidatePool: cached.candidate_pool,
        dismissed: cached.dismissed,
        emptyPool: cached.emptyPool,
        poolSize: cached.poolSize,
        source: "cache",
      };
    }
  }

  const [pool, history] = await Promise.all([
    getEligibleContentPool(args.userId),
    getDecayedHistory(args.userId, now),
  ]);

  if (pool.length < ELIGIBLE_POOL_THRESHOLD) {
    // Still emit every day: the strip needs to know the library is too small,
    // which is a different message from "no picks today".
    const emptyPayload = emptyDaysPayload(WEEK_DAY_INDEXES);
    logCoverage({
      userId: args.userId,
      weekStart: args.weekStart,
      source: "fallback",
      poolSize: pool.length,
      emptyPool: true,
      diagnostics: [],
    });
    await upsertCache({
      userId: args.userId,
      weekStart: args.weekStart,
      payload: emptyPayload,
      candidatePool: {},
      poolSize: pool.length,
      emptyPool: true,
      now,
    });
    return {
      payload: emptyPayload,
      candidatePool: {},
      dismissed: {},
      emptyPool: true,
      poolSize: pool.length,
      source: "fallback",
    };
  }

  const summary = summariseWeekItems(args.thisWeekItems);

  const cachedRow = await getCached(args.userId, args.weekStart, now).catch(
    () => null
  );
  const dismissalMap: DismissalMap = cachedRow?.dismissed ?? {};

  const { candidatesByDay, diagnostics } = planWeekCoverage({
    pool,
    history,
    summary,
    dismissedByDay: dismissalMap,
    weekStart: args.weekStart,
    now,
    targetDays,
    topN: 8,
  });

  // The curator only sees days it can actually pick from; days that ranked
  // nothing keep their explicit empty entry from the skeleton below.
  const daysWithCandidates: Record<number, ScoredCandidate[]> = {};
  for (const [dayStr, list] of Object.entries(candidatesByDay)) {
    if (list.length > 0) daysWithCandidates[Number(dayStr)] = list;
  }

  let picks: SuggestionPayload;
  let source: "ai" | "fallback";
  if (args.curatorEnabled && Object.keys(daysWithCandidates).length > 0) {
    const result = await curate({
      weekStart: args.weekStart,
      alreadyPlanned: summary.alreadyPlanned,
      patternProfile: buildPatternProfile(history),
      candidatesByDay: daysWithCandidates,
    });
    picks = result.picks;
    source = result.source;
  } else {
    picks = payloadFromCandidates(daysWithCandidates, 3);
    source = "fallback";
  }

  // Invariant: the payload covers the whole visible week even on a single-day
  // refresh. A missing day renders as nothing at all, which is the bug this
  // is guarding against.
  const payload: SuggestionPayload = emptyDaysPayload(WEEK_DAY_INDEXES);
  let candidatePool: CandidatePool = {};

  // Days outside the refresh scope keep whatever was cached for them.
  if (args.onlyDayIndex !== undefined && cachedRow) {
    Object.assign(payload, cachedRow.payload);
    candidatePool = { ...cachedRow.candidate_pool };
  }

  for (const day of targetDays) {
    payload[day] = picks[day] ?? [];
  }
  candidatePool = { ...candidatePool, ...poolFromCandidates(candidatesByDay) };

  logCoverage({
    userId: args.userId,
    weekStart: args.weekStart,
    source,
    poolSize: pool.length,
    emptyPool: false,
    diagnostics,
  });

  await upsertCache({
    userId: args.userId,
    weekStart: args.weekStart,
    payload,
    candidatePool,
    dismissed: dismissalMap,
    poolSize: pool.length,
    emptyPool: false,
    now,
  });

  return {
    payload,
    candidatePool,
    dismissed: dismissalMap,
    emptyPool: false,
    poolSize: pool.length,
    source,
  };
}
