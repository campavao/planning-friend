/**
 * Which days get suggestions, and why the ones that don't, don't.
 *
 * These drive `planWeekCoverage` directly with a pool, a set of planned items
 * and a dismissal map — the three inputs that actually decide coverage — so a
 * day going missing shows up here rather than as a blank card in the app.
 */

import {
  DAY_FULL_THRESHOLD,
  MIN_CANDIDATES_PER_DAY,
  WEEK_DAY_INDEXES,
  mondayIndexOf,
  planWeekCoverage,
  summariseWeekItems,
} from "@/lib/recommendations/coverage";
import type { DecayedHistory } from "@/lib/db/planner";
import type { ContentWithTags } from "@/lib/db/types";

const NOW = new Date("2026-03-12T12:00:00.000Z");
const WEEK_START = "2026-03-09"; // a Monday

// Monday 2026-03-09 .. Sunday 2026-03-15 at 19:00 UTC.
function dayDate(dayIndex: number): string {
  return `2026-03-${String(9 + dayIndex).padStart(2, "0")}T19:00:00.000Z`;
}

function item(id: string, category = "meal"): ContentWithTags {
  return {
    id,
    user_id: "user-1",
    tiktok_url: `https://example.com/${id}`,
    category: category as ContentWithTags["category"],
    title: id,
    data: {},
    status: "completed",
    created_at: "2026-01-01T00:00:00.000Z",
    tags: [],
  };
}

function pool(size: number): ContentWithTags[] {
  return Array.from({ length: size }, (_, i) => item(`c${i + 1}`));
}

const NO_HISTORY: DecayedHistory = { items: [], weeksOfHistory: 0 };

function coverageFor(args: {
  pool: ContentWithTags[];
  planned?: Array<{ dayIndex: number; contentId?: string }>;
  dismissedByDay?: Record<number, string[]>;
  targetDays?: number[];
}) {
  const summary = summariseWeekItems(
    (args.planned ?? []).map((p) => ({
      plannedDate: dayDate(p.dayIndex),
      contentId: p.contentId ?? null,
      category: "meal",
      title: p.contentId ?? "Something",
    }))
  );
  return planWeekCoverage({
    pool: args.pool,
    history: NO_HISTORY,
    summary,
    dismissedByDay: args.dismissedByDay ?? {},
    weekStart: WEEK_START,
    now: NOW,
    targetDays: args.targetDays,
  });
}

function statusByDay(diagnostics: ReturnType<typeof coverageFor>["diagnostics"]) {
  return Object.fromEntries(diagnostics.map((d) => [d.dayIndex, d.status]));
}

describe("mondayIndexOf", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(mondayIndexOf(dayDate(0))).toBe(0);
    expect(mondayIndexOf(dayDate(6))).toBe(6);
  });

  it("returns null for an unparseable date instead of guessing a day", () => {
    expect(mondayIndexOf("not a date")).toBeNull();
  });
});

describe("summariseWeekItems", () => {
  it("counts quick notes toward a day even though they have no content id", () => {
    const summary = summariseWeekItems([
      { plannedDate: dayDate(3), contentId: null, title: "Dentist" },
      { plannedDate: dayDate(3), contentId: "c1", title: "Tacos", category: "meal" },
    ]);
    expect(summary.plannedCountByDay[3]).toBe(2);
    expect([...summary.plannedIdsByDay[3]]).toEqual(["c1"]);
    expect([...summary.thisWeekContentIds]).toEqual(["c1"]);
  });

  it("ignores items whose date does not parse", () => {
    const summary = summariseWeekItems([
      { plannedDate: "garbage", contentId: "c1" },
    ]);
    expect(summary.thisWeekContentIds.size).toBe(0);
    expect(Object.values(summary.plannedCountByDay)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("planWeekCoverage day coverage", () => {
  it("returns an entry for every day of the week, empty ones included", () => {
    const { candidatesByDay, diagnostics } = coverageFor({ pool: pool(6) });

    expect(Object.keys(candidatesByDay)).toHaveLength(7);
    expect(diagnostics).toHaveLength(7);
    for (const day of WEEK_DAY_INDEXES) {
      expect(candidatesByDay[day]).toBeDefined();
    }
  });

  it("only covers the requested day on a single-day refresh", () => {
    const { candidatesByDay } = coverageFor({
      pool: pool(6),
      targetDays: [4],
    });
    expect(Object.keys(candidatesByDay)).toEqual(["4"]);
  });

  // The rule this ticket exists to change: one item on a day used to silence
  // it completely.
  const filledDayCases: Array<{
    name: string;
    plannedOnThursday: number;
    expected: "picks" | "day_full";
  }> = [
    { name: "an untouched day", plannedOnThursday: 0, expected: "picks" },
    { name: "a day holding one item", plannedOnThursday: 1, expected: "picks" },
    { name: "a day holding two items", plannedOnThursday: 2, expected: "day_full" },
    { name: "a day holding four items", plannedOnThursday: 4, expected: "day_full" },
  ];

  it.each(filledDayCases)(
    "treats $name as $expected",
    ({ plannedOnThursday, expected }) => {
      const { candidatesByDay, diagnostics } = coverageFor({
        pool: pool(8),
        planned: Array.from({ length: plannedOnThursday }, (_, i) => ({
          dayIndex: 3,
          contentId: `planned-${i}`,
        })),
      });

      expect(statusByDay(diagnostics)[3]).toBe(expected);
      expect(candidatesByDay[3].length > 0).toBe(expected === "picks");
      // Full or not, the day is still present in the payload.
      expect(candidatesByDay[3]).toBeDefined();
    }
  );

  it("keeps the threshold and the rule in step", () => {
    const { diagnostics } = coverageFor({
      pool: pool(8),
      planned: Array.from({ length: DAY_FULL_THRESHOLD }, (_, i) => ({
        dayIndex: 0,
        contentId: `planned-${i}`,
      })),
    });
    expect(statusByDay(diagnostics)[0]).toBe("day_full");
  });

  it("does not spend a ranking pass on a full day", () => {
    const { diagnostics } = coverageFor({
      pool: pool(8),
      planned: [
        { dayIndex: 1, contentId: "c1" },
        { dayIndex: 1, contentId: "c2" },
      ],
    });
    const monday = diagnostics.find((d) => d.dayIndex === 1)!;
    expect(monday.plannedCount).toBe(2);
    expect(monday.eligibleCount).toBe(0);
    expect(monday.rankedCount).toBe(0);
  });
});

describe("planWeekCoverage filtering", () => {
  it("never re-suggests something already planned on that same day", () => {
    const { candidatesByDay } = coverageFor({
      pool: pool(4),
      planned: [{ dayIndex: 2, contentId: "c1" }],
    });
    const ids = candidatesByDay[2].map((c) => c.content.id);
    expect(ids).not.toContain("c1");
  });

  it("keeps the week varied while there is enough to go round", () => {
    // 10 items, one planned on Tuesday: every other day has plenty without it.
    const { candidatesByDay, diagnostics } = coverageFor({
      pool: pool(10),
      planned: [{ dayIndex: 1, contentId: "c1" }],
    });

    expect(candidatesByDay[4].map((c) => c.content.id)).not.toContain("c1");
    expect(diagnostics.find((d) => d.dayIndex === 4)!.relaxed).toBe(false);
  });

  it("relaxes the week-wide filter rather than leaving a day empty", () => {
    // 4 items, 3 of them planned across the week. Excluding all three leaves
    // Friday with a single candidate, so the narrower same-day rule wins.
    const { candidatesByDay, diagnostics } = coverageFor({
      pool: pool(4),
      planned: [
        { dayIndex: 0, contentId: "c1" },
        { dayIndex: 1, contentId: "c2" },
        { dayIndex: 2, contentId: "c3" },
      ],
    });

    const friday = diagnostics.find((d) => d.dayIndex === 4)!;
    expect(friday.relaxed).toBe(true);
    expect(friday.status).toBe("picks");
    expect(candidatesByDay[4]).toHaveLength(4);
    expect(candidatesByDay[4].length).toBeGreaterThanOrEqual(
      MIN_CANDIDATES_PER_DAY
    );
  });

  it("still excludes the same day's own items when the filter is relaxed", () => {
    const { candidatesByDay, diagnostics } = coverageFor({
      pool: pool(4),
      planned: [
        { dayIndex: 0, contentId: "c1" },
        { dayIndex: 1, contentId: "c2" },
        { dayIndex: 2, contentId: "c3" },
      ],
    });

    expect(diagnostics.find((d) => d.dayIndex === 0)!.relaxed).toBe(true);
    expect(candidatesByDay[0].map((c) => c.content.id)).not.toContain("c1");
  });

  it("reports an honestly empty day instead of dropping it", () => {
    // Everything in the pool is dismissed for Wednesday.
    const { candidatesByDay, diagnostics } = coverageFor({
      pool: pool(3),
      dismissedByDay: { 2: ["c1", "c2", "c3"] },
    });

    const wednesday = diagnostics.find((d) => d.dayIndex === 2)!;
    expect(wednesday.status).toBe("no_candidates");
    expect(wednesday.filteredDismissed).toBe(3);
    expect(candidatesByDay[2]).toEqual([]);
    // The other days are unaffected — dismissals are per day.
    expect(candidatesByDay[3].length).toBe(3);
  });

  it("applies dismissals per day, not across the week", () => {
    const { candidatesByDay } = coverageFor({
      pool: pool(5),
      dismissedByDay: { 5: ["c1"] },
    });
    expect(candidatesByDay[5].map((c) => c.content.id)).not.toContain("c1");
    expect(candidatesByDay[6].map((c) => c.content.id)).toContain("c1");
  });
});

describe("planWeekCoverage diagnostics", () => {
  it("accounts for every item in the pool", () => {
    const { diagnostics } = coverageFor({
      pool: pool(6),
      planned: [{ dayIndex: 6, contentId: "c1" }],
      dismissedByDay: { 4: ["c2", "c3"] },
    });

    for (const day of diagnostics) {
      if (day.status === "day_full") continue;
      expect(
        day.filteredDismissed + day.filteredPlanned + day.eligibleCount
      ).toBe(day.poolSize);
    }
  });

  it("names the day, its status and the counts behind it", () => {
    const { diagnostics } = coverageFor({
      pool: pool(6),
      dismissedByDay: { 3: ["c1", "c2"] },
    });

    const thursday = diagnostics.find((d) => d.dayIndex === 3)!;
    expect(thursday).toMatchObject({
      dayIndex: 3,
      plannedCount: 0,
      poolSize: 6,
      filteredDismissed: 2,
      filteredPlanned: 0,
      eligibleCount: 4,
      rankedCount: 4,
      relaxed: false,
      status: "picks",
    });
  });

  it("caps a day at topN but still reports the full eligible count", () => {
    const { candidatesByDay, diagnostics } = coverageFor({ pool: pool(20) });
    expect(candidatesByDay[0]).toHaveLength(8);
    expect(diagnostics.find((d) => d.dayIndex === 0)!.eligibleCount).toBe(20);
  });
});
