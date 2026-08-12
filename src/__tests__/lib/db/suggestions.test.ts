/**
 * Cache versioning for weekly_plan_suggestions.
 *
 * The point of the stamp is that a payload written by an older engine is
 * recomputed on the next read instead of being served, so a fix to the
 * suggestion rules does not sit behind a 24h TTL after deploy.
 */

import {
  SUGGESTION_CACHE_VERSION,
  readVersionedPayload,
  wrapVersionedPayload,
  type SuggestionPayload,
} from "@/lib/db/suggestions";

const DAYS: SuggestionPayload = {
  0: [{ contentId: "c1", why: "Monday usually means pasta" }],
  1: [],
  2: [],
  3: [{ contentId: "c2", why: null }],
  4: [],
  5: [],
  6: [],
};

describe("wrapVersionedPayload", () => {
  it("stamps the current version and carries the pool facts", () => {
    const wrapped = wrapVersionedPayload({
      days: DAYS,
      poolSize: 12,
      emptyPool: false,
    });
    expect(wrapped).toEqual({
      v: SUGGESTION_CACHE_VERSION,
      days: DAYS,
      poolSize: 12,
      emptyPool: false,
    });
  });

  it("round-trips through JSON the way the jsonb column stores it", () => {
    const stored = JSON.parse(
      JSON.stringify(
        wrapVersionedPayload({ days: DAYS, poolSize: 2, emptyPool: true })
      )
    );
    const read = readVersionedPayload(stored);
    expect(read?.days).toEqual(DAYS);
    expect(read?.poolSize).toBe(2);
    expect(read?.emptyPool).toBe(true);
  });
});

describe("readVersionedPayload", () => {
  it("rejects the unstamped v1 shape written before this change", () => {
    // What the column held previously: day indexes at the top level.
    expect(readVersionedPayload({ "0": [{ contentId: "c1", why: null }] })).toBeNull();
  });

  it("rejects a payload from a different engine version", () => {
    expect(
      readVersionedPayload({
        v: SUGGESTION_CACHE_VERSION - 1,
        days: DAYS,
        poolSize: 4,
        emptyPool: false,
      })
    ).toBeNull();
    expect(
      readVersionedPayload({
        v: SUGGESTION_CACHE_VERSION + 1,
        days: DAYS,
        poolSize: 4,
        emptyPool: false,
      })
    ).toBeNull();
  });

  it("rejects anything that is not an envelope at all", () => {
    expect(readVersionedPayload(null)).toBeNull();
    expect(readVersionedPayload(undefined)).toBeNull();
    expect(readVersionedPayload("{}")).toBeNull();
    expect(readVersionedPayload([])).toBeNull();
    expect(readVersionedPayload({ v: SUGGESTION_CACHE_VERSION })).toBeNull();
  });

  it("defaults the pool facts rather than failing a well-versioned row", () => {
    const read = readVersionedPayload({
      v: SUGGESTION_CACHE_VERSION,
      days: DAYS,
    });
    expect(read?.poolSize).toBe(0);
    expect(read?.emptyPool).toBe(false);
  });
});
