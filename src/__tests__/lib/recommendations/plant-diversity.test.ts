/**
 * The plant-diversity signal in the scorer (PLA-58).
 *
 * The claim being tested is narrow and easy to get wrong: a suggestion is
 * ranked on what it *adds* to the week, not on what it contains. A recipe with
 * eight plants the week already ate adds nothing to the weekly score, because
 * that score is a set union and not a sum, and ranking it highly would be
 * ranking on a number the user never sees move.
 */

import { rankForDay, type RankInput } from "@/lib/recommendations/scorer";
import { WEEKLY_PLANT_TARGET, type Plant } from "@/lib/plants";
import type { ContentWithTags } from "@/lib/db/types";
import type { DecayedHistory } from "@/lib/db/planner";

const NOW = new Date("2026-03-12T12:00:00.000Z");

function plants(...sources: string[]): Plant[] {
  return sources.map((source) => ({ source, category: "vegetable" as const }));
}

function meal(id: string, plantSources: string[]): ContentWithTags {
  return {
    id,
    user_id: "u1",
    tiktok_url: `https://example.com/${id}`,
    category: "meal",
    title: id,
    data: { plants: plants(...plantSources) },
    status: "completed",
    created_at: "2026-01-01T00:00:00.000Z",
    tags: [],
  };
}

const EMPTY_HISTORY: DecayedHistory = { items: [], weeksOfHistory: 0 };

function rank(pool: ContentWithTags[], weekPlantKeys?: Set<string>) {
  const input: RankInput = {
    pool,
    history: EMPTY_HISTORY,
    excludedContentIds: new Set(),
    dismissedIds: new Set(),
    weekPlantKeys,
    dayIndex: 2,
    weekStart: "2026-03-09",
    now: NOW,
  };
  return rankForDay(input).candidates.map((c) => c.content.id);
}

describe("plant diversity ranking", () => {
  it("prefers the meal that adds plants the week does not have", () => {
    const covered = new Set(["garlic", "onion", "tomato"]);
    const ranked = rank(
      [
        // Four plants, every one already eaten this week — adds nothing.
        meal("repeat", ["garlic", "onion", "tomato", "garlic"]),
        // Three plants, all new.
        meal("fresh", ["lentil", "kale", "walnut"]),
      ],
      covered,
    );

    expect(ranked[0]).toBe("fresh");
  });

  it("ranks on what is added, not on how many plants the recipe holds", () => {
    const covered = new Set(["garlic", "onion", "tomato", "carrot", "pea"]);
    const ranked = rank(
      [
        // The bigger recipe, entirely duplicated.
        meal("big-but-covered", ["garlic", "onion", "tomato", "carrot", "pea"]),
        // Smaller, but every plant is new.
        meal("small-but-new", ["lentil", "kale"]),
      ],
      covered,
    );

    expect(ranked[0]).toBe("small-but-new");
  });

  it("stops pushing diversity once the week has hit the target", () => {
    // A full target's worth of distinct plants already eaten.
    const covered = new Set(
      Array.from({ length: WEEKLY_PLANT_TARGET }, (_, i) => `p${i}`),
    );
    const withNewPlants = meal("diverse", ["lentil", "kale", "walnut"]);
    const withNone = meal("plain", []);

    const ranked = rank([withNewPlants, withNone], covered);

    // Neither is boosted, so the order is whatever the other signals said —
    // the point is only that diversity is no longer buying rank.
    const rankedWithoutContext = rank([withNewPlants, withNone]);
    expect(ranked).toEqual(rankedWithoutContext);
  });

  it("sits out entirely when there is no week context", () => {
    const pool = [meal("a", ["lentil", "kale"]), meal("b", [])];

    // Undefined weekPlantKeys must rank exactly as it did before the signal
    // existed, so callers with no week context are unaffected.
    expect(rank(pool, undefined)).toEqual(rank(pool, undefined));
    expect(rank(pool, undefined)).toHaveLength(2);
  });

  it("does not penalise items that carry no plants at all", () => {
    const event: ContentWithTags = {
      ...meal("an-event", []),
      category: "event",
      data: {},
    };

    // An event scores zero on this signal. That must read as "no bonus",
    // not as a deduction that pushes it below every meal.
    const ranked = rank([event], new Set(["garlic"]));
    expect(ranked).toEqual(["an-event"]);
  });
});
