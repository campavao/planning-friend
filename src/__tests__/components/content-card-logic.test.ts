/**
 * Tests for the pure logic extracted from content-card.tsx
 * Tests category routing, Google Maps URL generation, and tag extraction
 */

import type { ContentCategory } from "@/lib/db/types";

// ============================================
// getGoogleMapsUrl (replicated from content-card.tsx)
// ============================================
function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

describe("getGoogleMapsUrl (content-card)", () => {
  it("encodes a simple location", () => {
    expect(getGoogleMapsUrl("Central Park")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Central%20Park"
    );
  });

  it("encodes location with special characters", () => {
    expect(getGoogleMapsUrl("Joe's Pizza, NYC")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Joe's%20Pizza%2C%20NYC"
    );
  });

  it("encodes a full address", () => {
    const address = "123 Main St, New York, NY 10001";
    const url = getGoogleMapsUrl(address);
    expect(url).toContain("123%20Main%20St");
    expect(url).toContain("New%20York");
  });

  it("handles empty location", () => {
    expect(getGoogleMapsUrl("")).toBe(
      "https://www.google.com/maps/search/?api=1&query="
    );
  });

  it("encodes ampersands", () => {
    expect(getGoogleMapsUrl("Ben & Jerry's")).toContain("Ben%20%26%20Jerry's");
  });
});

// ============================================
// Category icons/labels/colors mapping (from content-card.tsx)
// ============================================
const CATEGORY_LABELS: Record<string, string> = {
  meal: "Recipe",
  drink: "Drink",
  event: "Event",
  date_idea: "Date",
  gift_idea: "Gift",
  travel: "Travel",
  other: "Saved",
};

describe("CATEGORY_LABELS", () => {
  it("has entries for all content categories", () => {
    const categories: ContentCategory[] = [
      "meal",
      "drink",
      "event",
      "date_idea",
      "gift_idea",
      "travel",
      "other",
    ];
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it("has human-friendly labels", () => {
    expect(CATEGORY_LABELS.meal).toBe("Recipe");
    expect(CATEGORY_LABELS.date_idea).toBe("Date");
    expect(CATEGORY_LABELS.gift_idea).toBe("Gift");
    expect(CATEGORY_LABELS.other).toBe("Saved");
  });
});

// ============================================
// Content card routing logic (status + category)
// ============================================
describe("ContentCard routing logic", () => {
  type CardType =
    | "processing"
    | "failed"
    | "meal"
    | "drink"
    | "event"
    | "date_idea"
    | "gift_idea"
    | "travel"
    | "other";

  // Simulate the routing logic from ContentCard
  function getCardType(
    status: string,
    category: ContentCategory
  ): CardType {
    if (status === "processing") return "processing";
    if (status === "failed") return "failed";
    return category;
  }

  it("routes processing status to ProcessingCard", () => {
    expect(getCardType("processing", "meal")).toBe("processing");
    expect(getCardType("processing", "event")).toBe("processing");
  });

  it("routes failed status to FailedCard", () => {
    expect(getCardType("failed", "meal")).toBe("failed");
    expect(getCardType("failed", "travel")).toBe("failed");
  });

  it("routes completed meal to MealCard", () => {
    expect(getCardType("completed", "meal")).toBe("meal");
  });

  it("routes completed drink to DrinkCard", () => {
    expect(getCardType("completed", "drink")).toBe("drink");
  });

  it("routes completed event to EventCard", () => {
    expect(getCardType("completed", "event")).toBe("event");
  });

  it("routes completed date_idea to DateIdeaCard", () => {
    expect(getCardType("completed", "date_idea")).toBe("date_idea");
  });

  it("routes completed gift_idea to GiftIdeaCard", () => {
    expect(getCardType("completed", "gift_idea")).toBe("gift_idea");
  });

  it("routes completed travel to TravelCard", () => {
    expect(getCardType("completed", "travel")).toBe("travel");
  });

  it("routes other category to OtherCard", () => {
    expect(getCardType("completed", "other")).toBe("other");
  });
});

// ============================================
// Tag extraction logic (from ContentCard)
// ============================================
describe("ContentCard tag extraction logic", () => {
  interface ContentLike {
    tags?: { id: string; name: string }[];
  }

  // Replicate the tag extraction logic
  function extractTags(
    content: ContentLike,
    propTags?: { id: string; name: string }[]
  ) {
    return propTags || ("tags" in content ? content.tags : undefined);
  }

  it("uses provided prop tags when available", () => {
    const propTags = [{ id: "1", name: "quick" }];
    const content = { tags: [{ id: "2", name: "dinner" }] };
    expect(extractTags(content, propTags)).toEqual(propTags);
  });

  it("falls back to content.tags when no prop tags", () => {
    const content = { tags: [{ id: "1", name: "quick" }] };
    expect(extractTags(content)).toEqual(content.tags);
  });

  it("returns undefined when no tags anywhere", () => {
    const content = {};
    expect(extractTags(content)).toBeUndefined();
  });
});
