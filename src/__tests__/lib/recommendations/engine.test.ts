/**
 * The shape of what `getOrComputeSuggestions` actually hands back.
 *
 * The bug being guarded against is a day disappearing from the payload
 * entirely: downstream that renders as nothing, indistinguishable from a
 * broken feature. So the assertions here are about which keys exist, not about
 * which internals were called.
 */

import { getOrComputeSuggestions } from "@/lib/recommendations";
import type { DecayedHistory } from "@/lib/db/planner";
import type { ContentWithTags } from "@/lib/db/types";
import type { SuggestionPayload } from "@/lib/db/suggestions";

jest.mock("@/lib/db/planner", () => ({
  ...jest.requireActual("@/lib/db/planner"),
  getEligibleContentPool: jest.fn(),
  getDecayedHistory: jest.fn(),
}));

jest.mock("@/lib/db/suggestions", () => ({
  getCached: jest.fn(),
  upsertCache: jest.fn(async () => ({})),
}));

import { getDecayedHistory, getEligibleContentPool } from "@/lib/db/planner";
import { getCached, upsertCache } from "@/lib/db/suggestions";

const mockPool = getEligibleContentPool as jest.MockedFunction<
  typeof getEligibleContentPool
>;
const mockHistory = getDecayedHistory as jest.MockedFunction<
  typeof getDecayedHistory
>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const mockUpsert = upsertCache as jest.MockedFunction<typeof upsertCache>;

const NOW = new Date("2026-03-12T12:00:00.000Z");
const WEEK_START = "2026-03-09";

function dayDate(dayIndex: number): string {
  return `2026-03-${String(9 + dayIndex).padStart(2, "0")}T19:00:00.000Z`;
}

function content(id: string): ContentWithTags {
  return {
    id,
    user_id: "user-1",
    tiktok_url: `https://example.com/${id}`,
    category: "meal",
    title: id,
    data: {},
    status: "completed",
    created_at: "2026-01-01T00:00:00.000Z",
    tags: [],
  };
}

const EMPTY_HISTORY: DecayedHistory = { items: [], weeksOfHistory: 0 };

function setPool(size: number) {
  mockPool.mockResolvedValue(
    Array.from({ length: size }, (_, i) => content(`c${i + 1}`))
  );
}

let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  mockHistory.mockResolvedValue(EMPTY_HISTORY);
  mockGetCached.mockResolvedValue(null);
  mockUpsert.mockImplementation(async () => ({}) as never);
  setPool(10);
});

afterEach(() => {
  logSpy.mockRestore();
});

/** The per-day diagnostics from the single structured coverage log line. */
function loggedDays() {
  const call = logSpy.mock.calls.find((c) => c[0] === "[suggestions] coverage");
  return JSON.parse(call![1] as string) as {
    poolSize: number;
    emptyPool: boolean;
    days: Array<Record<string, unknown>>;
  };
}

function dayKeys(payload: SuggestionPayload): number[] {
  return Object.keys(payload)
    .map(Number)
    .sort((a, b) => a - b);
}

describe("getOrComputeSuggestions payload coverage", () => {
  it("emits every day of the week", async () => {
    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      now: NOW,
    });

    expect(dayKeys(result.payload)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      expect(result.payload[day].length).toBeGreaterThan(0);
    }
  });

  it("keeps a day with a single item in the payload, with real picks", async () => {
    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [
        { plannedDate: dayDate(3), contentId: "c1", category: "meal", title: "Lunch" },
      ],
      now: NOW,
    });

    expect(dayKeys(result.payload)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result.payload[3].length).toBeGreaterThan(0);
    expect(result.payload[3].map((p) => p.contentId)).not.toContain("c1");
  });

  it("keeps a full day in the payload as an explicit empty list", async () => {
    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [
        { plannedDate: dayDate(3), contentId: "c1", category: "meal", title: "Lunch" },
        { plannedDate: dayDate(3), contentId: "c2", category: "meal", title: "Dinner" },
      ],
      now: NOW,
    });

    expect(dayKeys(result.payload)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result.payload[3]).toEqual([]);
  });

  it("emits every day even when the library is too small to rank", async () => {
    setPool(1);

    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      now: NOW,
    });

    expect(dayKeys(result.payload)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result.emptyPool).toBe(true);
    expect(result.poolSize).toBe(1);
  });

  it("still covers the week when only one day is refreshed", async () => {
    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      force: true,
      onlyDayIndex: 5,
      now: NOW,
    });

    expect(dayKeys(result.payload)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result.payload[5].length).toBeGreaterThan(0);
    // Untouched days have no cached picks to restore, so they stay explicitly
    // empty rather than vanishing.
    expect(result.payload[0]).toEqual([]);
  });

  it("caches the same day coverage it returns", async () => {
    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      now: NOW,
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const written = mockUpsert.mock.calls[0][0];
    expect(written.payload).toEqual(result.payload);
    expect(written.poolSize).toBe(10);
    expect(written.emptyPool).toBe(false);
  });
});

describe("getOrComputeSuggestions instrumentation", () => {
  it("logs why each day landed where it did", async () => {
    await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [
        { plannedDate: dayDate(3), contentId: "c1", category: "meal", title: "Lunch" },
        { plannedDate: dayDate(3), contentId: "c2", category: "meal", title: "Dinner" },
      ],
      now: NOW,
    });

    const logged = loggedDays();
    expect(logged.days).toHaveLength(7);

    // "Why was Thursday empty?" — answerable from the log line alone.
    expect(logged.days.find((d) => d.day === 3)).toMatchObject({
      day: 3,
      status: "day_full",
      planned: 2,
    });
    expect(logged.days.find((d) => d.day === 0)).toMatchObject({
      day: 0,
      status: "picks",
      pool: 10,
      alreadyPlanned: 2,
      eligible: 8,
    });
  });

  it("logs the too-small library case as such", async () => {
    setPool(2);

    await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      now: NOW,
    });

    const logged = loggedDays();
    expect(logged.emptyPool).toBe(true);
    expect(logged.poolSize).toBe(2);
  });
});

describe("getOrComputeSuggestions cache reads", () => {
  it("serves a cached week without recomputing, pool facts included", async () => {
    const cachedPayload: SuggestionPayload = {
      0: [{ contentId: "c1", why: null }],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    mockGetCached.mockResolvedValue({
      id: "row-1",
      user_id: "user-1",
      week_start: WEEK_START,
      payload: cachedPayload,
      candidate_pool: { 0: ["c1", "c2"] },
      dismissed: {},
      generated_at: NOW.toISOString(),
      expires_at: new Date(NOW.getTime() + 3600_000).toISOString(),
      poolSize: 7,
      emptyPool: false,
    });

    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      now: NOW,
    });

    expect(result.source).toBe("cache");
    expect(result.payload).toEqual(cachedPayload);
    expect(result.poolSize).toBe(7);
    expect(mockPool).not.toHaveBeenCalled();
  });

  it("reports a cached too-small library rather than silently showing nothing", async () => {
    mockGetCached.mockResolvedValue({
      id: "row-1",
      user_id: "user-1",
      week_start: WEEK_START,
      payload: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
      candidate_pool: {},
      dismissed: {},
      generated_at: NOW.toISOString(),
      expires_at: new Date(NOW.getTime() + 3600_000).toISOString(),
      poolSize: 2,
      emptyPool: true,
    });

    const result = await getOrComputeSuggestions({
      userId: "user-1",
      weekStart: WEEK_START,
      thisWeekItems: [],
      now: NOW,
    });

    expect(result.emptyPool).toBe(true);
    expect(result.poolSize).toBe(2);
  });
});
