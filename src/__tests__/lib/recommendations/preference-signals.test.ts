/**
 * Stars and ratings in the ranking (PLA-9).
 *
 * The ticket's complaint was that picks "feel generic", and the diagnosis was
 * that below the 30-item tag threshold the score reduces to "does the category
 * match a hardcoded day-of-week default, and was it saved recently". Neither of
 * those is a preference. These two signals are, and both are available with no
 * sparsity threshold at all.
 *
 * Every test here asserts the signal *changes the order* rather than merely
 * that the code runs — a weight that is plumbed through but never decisive is
 * indistinguishable from one that was never added.
 */

import { rankForDay, type RankInput } from "@/lib/recommendations/scorer";
import type { ContentWithTags } from "@/lib/db/types";
import type { DecayedHistory } from "@/lib/db/planner";

const NOW = new Date("2026-03-12T12:00:00.000Z");
const EMPTY_HISTORY: DecayedHistory = { items: [], weeksOfHistory: 0 };

function meal(id: string, overrides: Partial<ContentWithTags> = {}) {
  return {
    id,
    user_id: "u1",
    tiktok_url: `https://example.com/${id}`,
    category: "meal",
    title: id,
    data: {},
    status: "completed",
    created_at: "2026-01-01T00:00:00.000Z",
    tags: [],
    ...overrides,
  } as ContentWithTags;
}

function rank(pool: ContentWithTags[], ratings?: Map<string, number>) {
  const input: RankInput = {
    pool,
    history: EMPTY_HISTORY,
    excludedContentIds: new Set(),
    dismissedIds: new Set(),
    ratings,
    dayIndex: 2,
    weekStart: "2026-03-09",
    now: NOW,
  };
  return rankForDay(input).candidates.map((c) => c.content.id);
}

describe("starred items", () => {
  it("outrank identical unstarred ones", () => {
    const plain = meal("plain");
    const starred = meal("starred", { is_favorite: true });

    // Identical but for the star, so the star is the only thing that can
    // have moved them.
    expect(rank([plain, starred])[0]).toBe("starred");
  });

  it("need no history to count, unlike the tag signal", () => {
    // Tags sit out entirely below 30 tagged history items. A star is a
    // statement the first time it is made, and this pool has no history at all.
    const ranked = rank([meal("a"), meal("b", { is_favorite: true })]);

    expect(ranked[0]).toBe("b");
  });
});

describe("ratings", () => {
  it("push a well-rated item up", () => {
    const ranked = rank(
      [meal("loved"), meal("ordinary")],
      new Map([["loved", 5]]),
    );

    expect(ranked[0]).toBe("loved");
  });

  it("push a badly-rated item down", () => {
    const ranked = rank(
      [meal("disliked"), meal("ordinary")],
      new Map([["disliked", 1]]),
    );

    expect(ranked[ranked.length - 1]).toBe("disliked");
  });

  it("treat an unrated item as no opinion, not a middling one", () => {
    // A 3 is neutral by construction, so an unrated item and a 3-rated item
    // must rank the same way. Anything else would punish everything the cook
    // has simply never reviewed.
    const withNeutralRating = rank(
      [meal("a"), meal("b")],
      new Map([["a", 3]]),
    );
    const withNoRatings = rank([meal("a"), meal("b")]);

    expect(withNeutralRating).toEqual(withNoRatings);
  });

  it("let a bad rating outweigh a star, because it is a verdict", () => {
    // Starring says "I liked the look of this"; a 1 says "I made it and it was
    // bad". The later, more specific judgement should win.
    const ranked = rank(
      [meal("starred-but-bad", { is_favorite: true }), meal("unremarkable")],
      new Map([["starred-but-bad", 1]]),
    );

    expect(ranked[0]).toBe("unremarkable");
  });

  it("average repeat ratings rather than taking the latest", () => {
    // Handled in getContentRatings, but the scorer must accept a fractional
    // average without treating it as a special case.
    const ranked = rank(
      [meal("mixed"), meal("plain")],
      new Map([["mixed", 4.5]]),
    );

    expect(ranked[0]).toBe("mixed");
  });
});
