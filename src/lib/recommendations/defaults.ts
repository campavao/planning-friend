import type { ContentCategory } from "@/lib/db/types";
import { ELIGIBLE_SUGGESTION_CATEGORIES } from "@/lib/db/planner";

const RAW_DAY_PATTERNS: Record<number, ContentCategory[]> = {
  0: ["meal"],
  1: ["meal", "date_idea"],
  2: ["meal"],
  3: ["date_idea", "event"],
  4: ["date_idea", "event"],
  5: ["event", "date_idea"],
  6: ["meal"],
};

export type CategoryDistribution = Record<ContentCategory, number>;

function emptyDistribution(): CategoryDistribution {
  return ELIGIBLE_SUGGESTION_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {} as CategoryDistribution);
}

export const DEFAULT_DAY_PATTERNS: Record<number, CategoryDistribution> =
  Object.fromEntries(
    Array.from({ length: 7 }, (_, day) => {
      const dist = emptyDistribution();
      const cats = RAW_DAY_PATTERNS[day] ?? ["meal"];
      const share = 1 / cats.length;
      for (const c of cats) dist[c] = share;
      return [day, dist];
    })
  ) as Record<number, CategoryDistribution>;

export function emptyCategoryDistribution(): CategoryDistribution {
  return emptyDistribution();
}
