/**
 * Tests for the filtering and counting logic from category-tabs.tsx
 * These test the core business logic without React rendering
 */

import type { ContentCategory } from "@/lib/db/types";

interface TagLike {
  id: string;
  name: string;
}

interface ContentItem {
  id: string;
  category: ContentCategory;
  tags?: TagLike[];
}

// Replicate filterByTags from CategoryTabs
function filterByTags(
  items: ContentItem[],
  selectedTags: string[]
): ContentItem[] {
  if (selectedTags.length === 0) return items;
  return items.filter((item) =>
    selectedTags.some((tagId) => item.tags?.some((t) => t.id === tagId))
  );
}

// Replicate getFilteredContent
function getFilteredContent(
  content: ContentItem[],
  selectedTags: string[],
  category?: string
): ContentItem[] {
  let items = content;
  if (category) {
    items = content.filter((c) => c.category === category);
  }
  return filterByTags(items, selectedTags);
}

// Replicate getCounts
function getCounts(content: ContentItem[], selectedTags: string[]) {
  const filtered = filterByTags(content, selectedTags);
  return {
    all: filtered.length,
    meals: filterByTags(
      content.filter((c) => c.category === "meal"),
      selectedTags
    ).length,
    drinks: filterByTags(
      content.filter((c) => c.category === "drink"),
      selectedTags
    ).length,
    events: filterByTags(
      content.filter((c) => c.category === "event"),
      selectedTags
    ).length,
    dates: filterByTags(
      content.filter((c) => c.category === "date_idea"),
      selectedTags
    ).length,
    gifts: filterByTags(
      content.filter((c) => c.category === "gift_idea"),
      selectedTags
    ).length,
    travel: filterByTags(
      content.filter((c) => c.category === "travel"),
      selectedTags
    ).length,
    other: filterByTags(
      content.filter((c) => c.category === "other"),
      selectedTags
    ).length,
  };
}

// Test data
const testContent: ContentItem[] = [
  { id: "1", category: "meal", tags: [{ id: "t1", name: "quick" }, { id: "t2", name: "dinner" }] },
  { id: "2", category: "meal", tags: [{ id: "t2", name: "dinner" }, { id: "t3", name: "healthy" }] },
  { id: "3", category: "drink", tags: [{ id: "t1", name: "quick" }] },
  { id: "4", category: "event", tags: [] },
  { id: "5", category: "date_idea", tags: [{ id: "t4", name: "romantic" }] },
  { id: "6", category: "gift_idea" },
  { id: "7", category: "travel", tags: [{ id: "t5", name: "budget" }] },
  { id: "8", category: "other" },
  { id: "9", category: "meal", tags: [{ id: "t3", name: "healthy" }] },
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
    // Items 4 (empty tags), 6 (no tags), 8 (no tags) should be excluded
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
    expect(result).toHaveLength(2); // items 2 and 9 (both have healthy tag)
  });

  it("filters by both category and tags", () => {
    const result = getFilteredContent(testContent, ["t1"], "meal");
    expect(result).toHaveLength(1); // Only item 1 (meal with quick tag)
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
    expect(counts.all).toBe(2); // Items 1 and 3
    expect(counts.meals).toBe(1); // Item 1
    expect(counts.drinks).toBe(1); // Item 3
    expect(counts.events).toBe(0);
    expect(counts.dates).toBe(0);
    expect(counts.gifts).toBe(0);
    expect(counts.travel).toBe(0);
    expect(counts.other).toBe(0);
  });

  it("returns all zeros when tag matches nothing", () => {
    const counts = getCounts(testContent, ["nonexistent"]);
    expect(counts.all).toBe(0);
    expect(counts.meals).toBe(0);
    expect(counts.drinks).toBe(0);
  });

  it("handles empty content list", () => {
    const counts = getCounts([], []);
    expect(counts.all).toBe(0);
    expect(counts.meals).toBe(0);
  });

  it("sum of individual categories equals total when no tags", () => {
    const counts = getCounts(testContent, []);
    const sum =
      counts.meals +
      counts.drinks +
      counts.events +
      counts.dates +
      counts.gifts +
      counts.travel +
      counts.other;
    expect(sum).toBe(counts.all);
  });
});

// ============================================
// toggleTag logic
// ============================================
describe("toggleTag logic", () => {
  function toggleTag(prev: string[], tagId: string): string[] {
    return prev.includes(tagId)
      ? prev.filter((t) => t !== tagId)
      : [...prev, tagId];
  }

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
