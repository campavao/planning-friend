/**
 * Tests for the filtering and counting logic from category-tabs.tsx
 * Imports real functions — no duplicated logic
 */

import {
  filterByTags,
  getFilteredContent,
  getCounts,
  toggleTag,
} from "@/components/category-tabs";
import type { ContentCategory } from "@/lib/db/types";

interface TagLike {
  id: string;
  name: string;
}

interface ContentItem {
  id: string;
  category: ContentCategory;
  title: string;
  status: string;
  data: Record<string, unknown>;
  user_id: string;
  created_at: string;
  updated_at: string;
  tags?: TagLike[];
  [key: string]: unknown;
}

// Test data
const testContent: ContentItem[] = [
  { id: "1", category: "meal", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t1", name: "quick" }, { id: "t2", name: "dinner" }] },
  { id: "2", category: "meal", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t2", name: "dinner" }, { id: "t3", name: "healthy" }] },
  { id: "3", category: "drink", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t1", name: "quick" }] },
  { id: "4", category: "event", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [] },
  { id: "5", category: "date_idea", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t4", name: "romantic" }] },
  { id: "6", category: "gift_idea", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "" },
  { id: "7", category: "travel", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t5", name: "budget" }] },
  { id: "8", category: "other", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "" },
  { id: "9", category: "meal", title: "t", status: "completed", data: {}, user_id: "u", created_at: "", updated_at: "", tags: [{ id: "t3", name: "healthy" }] },
];

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
