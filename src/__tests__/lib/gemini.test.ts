/**
 * Tests for parseAnalysisResponse from gemini.ts
 * Imports the real function — no duplicated logic
 */

import { parseAnalysisResponse } from "@/lib/gemini";
import type { ContentCategory } from "@/lib/db/types";

// ============================================
// parseAnalysisResponse - multi-item format
// ============================================
describe("parseAnalysisResponse", () => {
  describe("multi-item format", () => {
    it("parses a valid multi-item response", () => {
      const response = JSON.stringify({
        isMultiItem: true,
        items: [
          {
            category: "meal",
            title: "Pasta Carbonara",
            data: { ingredients: ["pasta", "eggs", "bacon"] },
            suggested_tags: ["dinner", "quick"],
          },
          {
            category: "meal",
            title: "Caesar Salad",
            data: { ingredients: ["lettuce", "croutons"] },
            suggested_tags: ["lunch", "healthy"],
          },
        ],
      });

      const result = parseAnalysisResponse(response);
      expect(result.isMultiItem).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe("Pasta Carbonara");
      expect(result.items[1].title).toBe("Caesar Salad");
    });

    it("sets isMultiItem true when there are multiple items even if flag is false", () => {
      const response = JSON.stringify({
        isMultiItem: false,
        items: [
          { category: "meal", title: "Item 1", data: {} },
          { category: "drink", title: "Item 2", data: {} },
        ],
      });

      const result = parseAnalysisResponse(response);
      expect(result.isMultiItem).toBe(true);
    });

    it("replaces invalid category with 'other'", () => {
      const response = JSON.stringify({
        isMultiItem: false,
        items: [
          {
            category: "invalid_category",
            title: "Unknown Thing",
            data: {},
          },
        ],
      });

      const result = parseAnalysisResponse(response);
      expect(result.items[0].category).toBe("other");
    });

    it("preserves valid categories", () => {
      const categories: ContentCategory[] = [
        "meal",
        "drink",
        "event",
        "date_idea",
        "gift_idea",
        "travel",
        "other",
      ];

      for (const category of categories) {
        const response = JSON.stringify({
          items: [{ category, title: "Test", data: {} }],
        });
        const result = parseAnalysisResponse(response);
        expect(result.items[0].category).toBe(category);
      }
    });

    it("preserves suggested_tags", () => {
      const response = JSON.stringify({
        items: [
          {
            category: "meal",
            title: "Test",
            data: {},
            suggested_tags: ["quick", "dinner", "healthy"],
          },
        ],
      });

      const result = parseAnalysisResponse(response);
      expect(result.items[0].suggested_tags).toEqual(["quick", "dinner", "healthy"]);
    });
  });

  describe("legacy single-item format", () => {
    it("parses a valid legacy response", () => {
      const response = JSON.stringify({
        category: "event",
        title: "Concert in the Park",
        data: { location: "Central Park", date: "2024-07-04" },
      });

      const result = parseAnalysisResponse(response);
      expect(result.isMultiItem).toBe(false);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].category).toBe("event");
      expect(result.items[0].title).toBe("Concert in the Park");
    });

    it("replaces invalid category in legacy format", () => {
      const response = JSON.stringify({
        category: "unknown",
        title: "Something",
        data: {},
      });

      const result = parseAnalysisResponse(response);
      expect(result.items[0].category).toBe("other");
    });
  });

  describe("JSON extraction from text", () => {
    it("extracts JSON from markdown code block", () => {
      const response = `Here's the analysis:
\`\`\`json
{
  "items": [{"category": "meal", "title": "Soup", "data": {}}]
}
\`\`\``;

      const result = parseAnalysisResponse(response);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Soup");
    });

    it("extracts JSON surrounded by text", () => {
      const response = `Based on my analysis: {"category": "drink", "title": "Mojito", "data": {"type": "cocktail"}} That's my result.`;

      const result = parseAnalysisResponse(response);
      expect(result.items[0].title).toBe("Mojito");
      expect(result.items[0].category).toBe("drink");
    });
  });

  describe("error handling", () => {
    it("throws for response with no JSON", () => {
      expect(() => parseAnalysisResponse("No JSON here")).toThrow(
        "No JSON found in response"
      );
    });

    it("throws for invalid JSON", () => {
      expect(() => parseAnalysisResponse("{invalid json}")).toThrow();
    });

    it("throws for JSON without required fields", () => {
      expect(() =>
        parseAnalysisResponse(JSON.stringify({ foo: "bar" }))
      ).toThrow("Invalid response structure");
    });

    it("accepts empty items array (handled by caller)", () => {
      expect(() =>
        parseAnalysisResponse(JSON.stringify({ items: [] }))
      ).not.toThrow();
    });
  });
});
