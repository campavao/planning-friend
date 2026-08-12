import type { ContentCategory, ContentWithTags } from "@/lib/db/types";
import type { DecayedHistory, DecayedHistoryItem } from "@/lib/db/planner";
import {
  DEFAULT_DAY_PATTERNS,
  emptyCategoryDistribution,
  type CategoryDistribution,
} from "./defaults";

const W_CAT = 0.40;
const W_TAG = 0.25;
const W_COOLDOWN = 0.20;
const W_RECENT = 0.10;
const W_TIEBREAK = 0.05;

const COOLDOWN_DAYS = 14;
const RECENTLY_SAVED_DAYS = 21;
const TAG_SPARSITY_THRESHOLD = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ALPHA_FULL_WEEKS = 4;

export interface ScoredCandidate {
  content: ContentWithTags;
  score: number;
}

export interface RankInput {
  pool: ContentWithTags[];
  history: DecayedHistory;
  /**
   * Content already committed to the plan. The caller decides how wide this
   * net is: the whole week on the first pass, just this day on the relaxed
   * retry. The scorer only knows "don't offer these".
   */
  excludedContentIds: Set<string>;
  dismissedIds: Set<string>;
  dayIndex: number;
  weekStart: string;
  now?: Date;
  topN?: number;
}

/**
 * Ranking plus the arithmetic behind it. The counts are the whole reason an
 * empty day is explainable after the fact: poolSize minus the two filtered
 * counts is what was actually available to score.
 */
export interface RankResult {
  candidates: ScoredCandidate[];
  poolSize: number;
  filteredDismissed: number;
  filteredPlanned: number;
  eligibleCount: number;
}

interface DayDistributions {
  category: Record<number, CategoryDistribution>;
  tagPerDay: Record<number, Map<string, number>>;
  taggedHistoryCount: number;
}

function buildDistributions(items: DecayedHistoryItem[]): DayDistributions {
  const category: Record<number, CategoryDistribution> = {};
  const tagPerDay: Record<number, Map<string, number>> = {};
  const dayCategoryTotals: Record<number, number> = {};
  const dayTagTotals: Record<number, number> = {};
  let taggedHistoryCount = 0;

  for (let day = 0; day < 7; day++) {
    category[day] = emptyCategoryDistribution();
    tagPerDay[day] = new Map();
    dayCategoryTotals[day] = 0;
    dayTagTotals[day] = 0;
  }

  for (const item of items) {
    const dist = category[item.dayIndex];
    if (item.category in dist) {
      dist[item.category as ContentCategory] += item.weight;
      dayCategoryTotals[item.dayIndex] += item.weight;
    }

    if (item.tagIds.length > 0) {
      taggedHistoryCount += 1;
      const map = tagPerDay[item.dayIndex];
      const perTagWeight = item.weight / item.tagIds.length;
      for (const tagId of item.tagIds) {
        map.set(tagId, (map.get(tagId) ?? 0) + perTagWeight);
        dayTagTotals[item.dayIndex] += perTagWeight;
      }
    }
  }

  for (let day = 0; day < 7; day++) {
    const catTotal = dayCategoryTotals[day];
    if (catTotal > 0) {
      const dist = category[day];
      for (const cat of Object.keys(dist) as ContentCategory[]) {
        dist[cat] = dist[cat] / catTotal;
      }
    }
    const tagTotal = dayTagTotals[day];
    if (tagTotal > 0) {
      const map = tagPerDay[day];
      for (const [tagId, w] of map.entries()) {
        map.set(tagId, w / tagTotal);
      }
    }
  }

  return { category, tagPerDay, taggedHistoryCount };
}

function blendDistributions(
  learned: CategoryDistribution,
  defaults: CategoryDistribution,
  alpha: number
): CategoryDistribution {
  const blended = emptyCategoryDistribution();
  for (const cat of Object.keys(blended) as ContentCategory[]) {
    blended[cat] = alpha * (learned[cat] ?? 0) + (1 - alpha) * (defaults[cat] ?? 0);
  }
  return blended;
}

function lastPlannedDays(
  history: DecayedHistoryItem[],
  contentId: string,
  now: Date
): number {
  let mostRecent = -Infinity;
  for (const item of history) {
    if (item.contentId !== contentId) continue;
    const ms = new Date(item.plannedDate).getTime();
    if (ms > mostRecent) mostRecent = ms;
  }
  if (mostRecent === -Infinity) return Infinity;
  return Math.max(0, (now.getTime() - mostRecent) / MS_PER_DAY);
}

function cooldownPenalty(daysSinceLast: number): number {
  if (!Number.isFinite(daysSinceLast)) return 0;
  if (daysSinceLast >= COOLDOWN_DAYS) return 0;
  return 1 - daysSinceLast / COOLDOWN_DAYS;
}

function recentlySavedBoost(createdAt: string, now: Date): number {
  const ms = new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return 0;
  const days = Math.max(0, (now.getTime() - ms) / MS_PER_DAY);
  if (days >= RECENTLY_SAVED_DAYS) return 0;
  return 1 - days / RECENTLY_SAVED_DAYS;
}

function stableHash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 0xffffffff;
}

export function rankForDay(input: RankInput): RankResult {
  const {
    pool,
    history,
    excludedContentIds,
    dismissedIds,
    dayIndex,
    weekStart,
    now = new Date(),
    topN = 8,
  } = input;

  const dists = buildDistributions(history.items);
  const alpha = Math.min(1, history.weeksOfHistory / ALPHA_FULL_WEEKS);

  const blendedCat = blendDistributions(
    dists.category[dayIndex],
    DEFAULT_DAY_PATTERNS[dayIndex],
    alpha
  );
  const tagDistForDay = dists.tagPerDay[dayIndex];
  const tagSignalActive = dists.taggedHistoryCount >= TAG_SPARSITY_THRESHOLD;

  // Counted in this order so the two tallies stay disjoint and
  // `filteredDismissed + filteredPlanned + eligibleCount === poolSize` holds.
  let filteredDismissed = 0;
  let filteredPlanned = 0;
  const eligible: ContentWithTags[] = [];
  for (const c of pool) {
    if (dismissedIds.has(c.id)) {
      filteredDismissed += 1;
      continue;
    }
    if (excludedContentIds.has(c.id)) {
      filteredPlanned += 1;
      continue;
    }
    eligible.push(c);
  }

  const scored: ScoredCandidate[] = eligible.map((content) => {
    const catScore = blendedCat[content.category] ?? 0;

    let tagScore = 0;
    if (tagSignalActive && content.tags.length > 0) {
      let sum = 0;
      for (const tag of content.tags) {
        sum += tagDistForDay.get(tag.id) ?? 0;
      }
      tagScore = sum / content.tags.length;
    }

    const days = lastPlannedDays(history.items, content.id, now);
    const cooldown = cooldownPenalty(days);
    const recent = recentlySavedBoost(content.created_at, now);
    const tiebreak = stableHash(`${content.id}:${weekStart}:${dayIndex}`);

    const score =
      W_CAT * catScore +
      W_TAG * tagScore -
      W_COOLDOWN * cooldown +
      W_RECENT * recent +
      W_TIEBREAK * tiebreak;

    return { content, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    candidates: scored.slice(0, topN),
    poolSize: pool.length,
    filteredDismissed,
    filteredPlanned,
    eligibleCount: eligible.length,
  };
}
