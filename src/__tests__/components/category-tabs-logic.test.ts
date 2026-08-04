/**
 * Tests for the filtering and counting logic from category-tabs.tsx
 * Imports real functions — no duplicated logic
 */

import {
  filterByTags,
  filterBySearch,
  getFilteredContent,
  getCounts,
  toggleTag,
} from "@/components/category-tabs";
import type { ContentWithTags } from "@/lib/db/types";

// Minimal fixtures cast to the real ContentWithTags shape; only the fields the
// filtering/counting logic reads (category, status, tags[].name) matter here.
const testContent = [
  { id: "1", tiktok_url: "", category: "meal", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t1", name: "quick" }, { id: "t2", name: "dinner" }] },
  { id: "2", tiktok_url: "", category: "meal", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t2", name: "dinner" }, { id: "t3", name: "healthy" }] },
  { id: "3", tiktok_url: "", category: "drink", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t1", name: "quick" }] },
  { id: "4", tiktok_url: "", category: "event", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [] },
  { id: "5", tiktok_url: "", category: "date_idea", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t4", name: "romantic" }] },
  { id: "6", tiktok_url: "", category: "gift_idea", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "" },
  { id: "7", tiktok_url: "", category: "travel", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t5", name: "budget" }] },
  { id: "8", tiktok_url: "", category: "other", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "" },
  { id: "9", tiktok_url: "", category: "meal", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t3", name: "healthy" }] },
] as unknown as ContentWithTags[];

// ============================================
// filterByTags
// ============================================
describe("filterByTags", () => {
  it("returns all items when no tags selected", () => {
    expect(filterByTags(testContent, [])).toEqual(testContent);
  });

  it("filters to items matching a single tag", () => {
    const result = filterByTags(testContent, ["t1"]);
    expect(result).toHaveLength(2); // items 1 and 3
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("filters with OR logic (any tag matches)", () => {
    const result = filterByTags(testContent, ["t1", "t4"]);
    expect(result).toHaveLength(3); // items 1, 3, and 5
  });

  it("excludes items with no tags", () => {
    const result = filterByTags(testContent, ["t1"]);
    expect(result.every((r) => r.tags && r.tags.length > 0)).toBe(true);
  });

  it("excludes items with empty tags array", () => {
    const result = filterByTags(testContent, ["t1"]);
    expect(result.find((r) => r.id === "4")).toBeUndefined();
  });

  it("returns empty array when no items match", () => {
    const result = filterByTags(testContent, ["nonexistent"]);
    expect(result).toHaveLength(0);
  });
});

// ============================================
// filterBySearch
// ============================================
const searchContent = [
  { id: "1", category: "meal", title: "Salmon Tacos", status: "completed", data: { ingredients: ["salmon", "tortillas"] }, tags: [{ id: "t1", name: "quick" }] },
  { id: "2", category: "date_idea", title: "Rooftop Bar", status: "completed", data: { description: "Sunset views downtown", location: "Chicago" }, tags: [] },
  { id: "3", category: "gift_idea", title: "Birthday Present", status: "completed", data: { name: "Espresso Machine" } },
  { id: "4", category: "travel", title: "Weekend Trip", status: "completed", data: { destination_city: "Lisbon", destination_country: "Portugal" }, tags: [] },
] as unknown as ContentWithTags[];

describe("filterBySearch", () => {
  it("returns all items for an empty or whitespace query", () => {
    expect(filterBySearch(searchContent, "")).toEqual(searchContent);
    expect(filterBySearch(searchContent, "   ")).toEqual(searchContent);
  });

  it("matches titles case-insensitively", () => {
    expect(filterBySearch(searchContent, "TACOS").map((r) => r.id)).toEqual(["1"]);
  });

  it("matches tag names", () => {
    expect(filterBySearch(searchContent, "quick").map((r) => r.id)).toEqual(["1"]);
  });

  it("matches string fields inside data", () => {
    expect(filterBySearch(searchContent, "sunset").map((r) => r.id)).toEqual(["2"]);
    expect(filterBySearch(searchContent, "chicago").map((r) => r.id)).toEqual(["2"]);
    expect(filterBySearch(searchContent, "espresso").map((r) => r.id)).toEqual(["3"]);
    expect(filterBySearch(searchContent, "portugal").map((r) => r.id)).toEqual(["4"]);
  });

  it("matches array fields inside data", () => {
    expect(filterBySearch(searchContent, "tortillas").map((r) => r.id)).toEqual(["1"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterBySearch(searchContent, "  tacos  ").map((r) => r.id)).toEqual(["1"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterBySearch(searchContent, "kayaking")).toHaveLength(0);
  });

  it("handles items with missing tags or data", () => {
    const sparse = [{ id: "1", title: "Plain" }] as unknown as ContentWithTags[];
    expect(filterBySearch(sparse, "plain")).toHaveLength(1);
    expect(filterBySearch(sparse, "other")).toHaveLength(0);
  });
});

// ============================================
// getFilteredContent
// ============================================
describe("getFilteredContent", () => {
  it("returns all content when no category or tags", () => {
    const result = getFilteredContent(testContent, []);
    expect(result).toHaveLength(9);
  });

  it("filters by category only", () => {
    const result = getFilteredContent(testContent, [], "meal");
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.category === "meal")).toBe(true);
  });

  it("filters by tags only (no category)", () => {
    const result = getFilteredContent(testContent, ["t3"]);
    expect(result).toHaveLength(2); // items 2 and 9
  });

  it("filters by both category and tags", () => {
    const result = getFilteredContent(testContent, ["t1"], "meal");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty when category has no matching tags", () => {
    const result = getFilteredContent(testContent, ["t5"], "meal");
    expect(result).toHaveLength(0);
  });

  it("narrows a category by search query", () => {
    const result = getFilteredContent(searchContent, [], "meal", "salmon");
    expect(result.map((r) => r.id)).toEqual(["1"]);
  });

  it("combines tags and search", () => {
    expect(getFilteredContent(searchContent, ["t1"], undefined, "tacos")).toHaveLength(1);
    expect(getFilteredContent(searchContent, ["t1"], undefined, "rooftop")).toHaveLength(0);
  });
});

// ============================================
// getCounts
// ============================================
describe("getCounts", () => {
  it("returns correct counts with no tag filter", () => {
    const counts = getCounts(testContent, []);
    expect(counts.all).toBe(9);
    expect(counts.meals).toBe(3);
    expect(counts.drinks).toBe(1);
    expect(counts.events).toBe(1);
    expect(counts.dates).toBe(1);
    expect(counts.gifts).toBe(1);
    expect(counts.travel).toBe(1);
    expect(counts.other).toBe(1);
  });

  it("adjusts counts when tag filter applied", () => {
    const counts = getCounts(testContent, ["t1"]);
    expect(counts.all).toBe(2);
    expect(counts.meals).toBe(1);
    expect(counts.drinks).toBe(1);
    expect(counts.events).toBe(0);
  });

  it("returns all zeros when tag matches nothing", () => {
    const counts = getCounts(testContent, ["nonexistent"]);
    expect(counts.all).toBe(0);
    expect(counts.meals).toBe(0);
  });

  it("handles empty content list", () => {
    const counts = getCounts([], []);
    expect(counts.all).toBe(0);
    expect(counts.meals).toBe(0);
  });

  it("narrows counts by search query", () => {
    const counts = getCounts(searchContent, [], "tacos");
    expect(counts.all).toBe(1);
    expect(counts.meals).toBe(1);
    expect(counts.dates).toBe(0);
    expect(counts.travel).toBe(0);
  });

  it("sum of individual categories equals total when no tags", () => {
    const counts = getCounts(testContent, []);
    const sum =
      counts.meals + counts.drinks + counts.events + counts.dates +
      counts.gifts + counts.travel + counts.other;
    expect(sum).toBe(counts.all);
  });
});

// ============================================
// toggleTag
// ============================================
describe("toggleTag", () => {
  it("adds a tag that is not selected", () => {
    expect(toggleTag([], "t1")).toEqual(["t1"]);
  });

  it("removes a tag that is already selected", () => {
    expect(toggleTag(["t1", "t2"], "t1")).toEqual(["t2"]);
  });

  it("can add multiple tags", () => {
    let tags: string[] = [];
    tags = toggleTag(tags, "t1");
    tags = toggleTag(tags, "t2");
    expect(tags).toEqual(["t1", "t2"]);
  });

  it("preserves order of other tags when removing", () => {
    expect(toggleTag(["t1", "t2", "t3"], "t2")).toEqual(["t1", "t3"]);
  });
});
