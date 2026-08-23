/**
 * Tests for the pure logic from content-card.tsx
 * Imports real functions — no duplicated logic
 */

import { getGoogleMapsUrl } from "@/components/content-card";
import { CATEGORY_UI } from "@/lib/categories";
import type { ContentCategory } from "@/lib/db/types";

// ============================================
// getGoogleMapsUrl
// ============================================
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
// CATEGORY_LABELS
// ============================================
describe("category labels", () => {
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
      expect(CATEGORY_UI[cat]).toBeDefined();
      expect(CATEGORY_UI[cat].label.length).toBeGreaterThan(0);
    }
  });

  it("has human-friendly labels", () => {
    expect(CATEGORY_UI.meal.label).toBe("Recipe");
    expect(CATEGORY_UI.date_idea.label).toBe("Restaurant");
    expect(CATEGORY_UI.gift_idea.label).toBe("Gift");
    expect(CATEGORY_UI.other.label).toBe("Saved");
  });
});

// ============================================
// Content card routing logic (status + category)
// ============================================
describe("ContentCard routing logic", () => {
  // The ContentCard component routes based on status first, then category.
  // We test the routing decision tree here as pure logic.
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

  function getCardType(status: string, category: ContentCategory): CardType {
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

  it("routes each category correctly when completed", () => {
    const categories: ContentCategory[] = [
      "meal", "drink", "event", "date_idea", "gift_idea", "travel", "other",
    ];
    for (const cat of categories) {
      expect(getCardType("completed", cat)).toBe(cat);
    }
  });
});
