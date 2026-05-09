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
import { rankForDay, type ScoredCandidate } from "./scorer";
import { curate, type CuratorContext } from "./curator";

const ELIGIBLE_POOL_THRESHOLD = 3;

export interface SuggestionsResult {
  payload: SuggestionPayload;
  candidatePool: CandidatePool;
  dismissed: DismissalMap;
  emptyPool: boolean;
  poolSize: number;
  source: "cache" | "ai" | "fallback";
}

export interface ThisWeekItemRef {
  plannedDate: string;
  contentId?: string | null;
  category?: string | null;
  title?: string | null;
}

export interface ComputeArgs {
  userId: string;
  weekStart: string;
  thisWeekItems: ThisWeekItemRef[];
  force?: boolean;
  onlyDayIndex?: number;
  curatorEnabled?: boolean;
  now?: Date;
}

function mondayIndex(value: string): number | null {
  const planned = new Date(value);
  if (Number.isNaN(planned.getTime())) return null;
  return (planned.getUTCDay() + 6) % 7;
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

export async function getOrComputeSuggestions(
  args: ComputeArgs
): Promise<SuggestionsResult> {
  const now = args.now ?? new Date();

  if (!args.force) {
    const cached = await getCached(args.userId, args.weekStart, now);
    if (cached) {
      return {
        payload: cached.payload,
        candidatePool: cached.candidate_pool,
        dismissed: cached.dismissed,
        emptyPool: false,
        poolSize: Object.values(cached.candidate_pool).reduce(
          (n, ids) => n + ids.length,
          0
        ),
        source: "cache",
      };
    }
  }

  const [pool, history] = await Promise.all([
    getEligibleContentPool(args.userId),
    getDecayedHistory(args.userId, now),
  ]);

  if (pool.length < ELIGIBLE_POOL_THRESHOLD) {
    const emptyPayload: SuggestionPayload = {};
    await upsertCache({
      userId: args.userId,
      weekStart: args.weekStart,
      payload: emptyPayload,
      candidatePool: {},
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

  const filledDays = new Set<number>();
  const thisWeekContentIds = new Set<string>();
  const alreadyPlanned: CuratorContext["alreadyPlanned"] = [];
  for (const item of args.thisWeekItems) {
    const day = mondayIndex(item.plannedDate);
    if (day === null) continue;
    filledDays.add(day);
    if (item.contentId) thisWeekContentIds.add(item.contentId);
    if (item.title && item.category) {
      alreadyPlanned.push({
        dayIndex: day,
        title: item.title,
        category: item.category,
      });
    }
  }

  const cachedRow = await getCached(args.userId, args.weekStart, now).catch(
    () => null
  );
  const dismissalMap: DismissalMap = cachedRow?.dismissed ?? {};
  const targetDays =
    args.onlyDayIndex !== undefined ? [args.onlyDayIndex] : [0, 1, 2, 3, 4, 5, 6];

  const candidatesByDay: Record<number, ScoredCandidate[]> = {};
  for (const day of targetDays) {
    if (filledDays.has(day)) continue;
    const dismissedIds = new Set(dismissalMap[day] ?? []);
    const ranked = rankForDay({
      pool,
      history,
      thisWeekContentIds,
      dismissedIds,
      dayIndex: day,
      weekStart: args.weekStart,
      now,
      topN: 8,
    });
    if (ranked.length > 0) candidatesByDay[day] = ranked;
  }

  if (Object.keys(candidatesByDay).length === 0) {
    await upsertCache({
      userId: args.userId,
      weekStart: args.weekStart,
      payload: {},
      candidatePool: {},
      dismissed: dismissalMap,
      now,
    });
    return {
      payload: {},
      candidatePool: {},
      dismissed: dismissalMap,
      emptyPool: false,
      poolSize: pool.length,
      source: "fallback",
    };
  }

  let payload: SuggestionPayload;
  let source: "ai" | "fallback";
  if (args.curatorEnabled) {
    const profile = buildPatternProfile(history);
    const result = await curate({
      weekStart: args.weekStart,
      alreadyPlanned,
      patternProfile: profile,
      candidatesByDay,
    });
    payload = result.picks;
    source = result.source;
  } else {
    payload = payloadFromCandidates(candidatesByDay, 3);
    source = "fallback";
  }

  let candidatePool = poolFromCandidates(candidatesByDay);

  // Preserve cached entries for days outside the refresh scope.
  if (args.onlyDayIndex !== undefined && cachedRow) {
    payload = { ...cachedRow.payload, ...payload };
    candidatePool = { ...cachedRow.candidate_pool, ...candidatePool };
  }

  await upsertCache({
    userId: args.userId,
    weekStart: args.weekStart,
    payload,
    candidatePool,
    dismissed: dismissalMap,
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
