import {
  hasSalvageableContent,
  isLowValueResult,
  shouldPreserveExisting,
} from "@/lib/processing/preserve";
import type { Content } from "@/lib/db/types";

const savedRecipe = {
  status: "completed",
  category: "meal",
  title: "Grandma Essie's Spaghetti Sauce",
  data: {
    ingredients: ["2 lb tomatoes", "1 onion"],
    recipe: ["Simmer for three hours"],
  },
} as unknown as Pick<Content, "status" | "category" | "title" | "data">;

describe("isLowValueResult", () => {
  it.each([
    "Unable to analyze content",
    "Unable to analyze video",
    "Undetermined Content",
    "Analysis returned no results",
    "No image found",
    "Failed to process image",
  ])("flags the placeholder title %s", (title) => {
    expect(isLowValueResult({ category: "other", title, data: {} })).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(
      isLowValueResult({ category: "other", title: "  UNABLE TO ANALYZE CONTENT  " })
    ).toBe(true);
  });

  it("flags an 'other' item carrying nothing but prose", () => {
    // Gemini parsed the source and found nothing in it.
    expect(
      isLowValueResult({
        category: "other",
        title: "Some Video",
        data: { description: "A video about something." },
      })
    ).toBe(true);
  });

  it("flags a missing or empty title", () => {
    expect(isLowValueResult({ category: "meal", title: "" })).toBe(true);
    expect(isLowValueResult(null)).toBe(true);
  });

  it("does NOT flag a real extraction", () => {
    expect(
      isLowValueResult({
        category: "meal",
        title: "Slow Cooker Honey Garlic Chicken",
        data: { ingredients: ["soy sauce"], recipe: ["Cook"] },
      })
    ).toBe(false);
  });

  it("does NOT flag a real 'other' item that has structure beyond a description", () => {
    expect(
      isLowValueResult({
        category: "other",
        title: "Disney Bounding as Pain & Panic",
        data: { description: "An outfit idea", location: "Disney World" },
      })
    ).toBe(false);
  });
});

describe("hasSalvageableContent", () => {
  it("protects a completed row with real data", () => {
    expect(hasSalvageableContent(savedRecipe)).toBe(true);
  });

  it("does not protect a row that is already a placeholder", () => {
    expect(
      hasSalvageableContent({
        ...savedRecipe,
        category: "other",
        title: "Unable to analyze content",
        data: { description: "Analysis failed" },
      })
    ).toBe(false);
  });

  it("does not protect a row still processing or failed", () => {
    expect(hasSalvageableContent({ ...savedRecipe, status: "processing" })).toBe(false);
    expect(hasSalvageableContent({ ...savedRecipe, status: "failed" })).toBe(false);
  });

  it("does not protect a row that does not exist", () => {
    expect(hasSalvageableContent(null)).toBe(false);
  });
});

describe("shouldPreserveExisting", () => {
  it("keeps a saved recipe when re-analysis returns a placeholder", () => {
    // The exact case that destroyed three items during the PLA-55 backfill.
    expect(
      shouldPreserveExisting(savedRecipe, {
        category: "other",
        title: "Unable to analyze content",
        data: { description: "Analysis failed" },
      })
    ).toBe(true);
  });

  it("lets a good re-analysis through", () => {
    expect(
      shouldPreserveExisting(savedRecipe, {
        category: "meal",
        title: "Grandma Essie's Spaghetti Sauce",
        data: { ingredients: ["2 lb tomatoes"], plants: [] },
      })
    ).toBe(false);
  });

  it("lets a first-time save through even when it is a placeholder", () => {
    // Nothing to protect yet — the row must record the failure.
    expect(
      shouldPreserveExisting(null, {
        category: "other",
        title: "Unable to analyze content",
      })
    ).toBe(false);
  });

  it("does NOT block a genuine re-categorisation", () => {
    // "Girl Dinner" (meal) coming back as a real gift_idea is a classification
    // change, not a failure. Blocking it would freeze every mis-filed item.
    expect(
      shouldPreserveExisting(savedRecipe, {
        category: "gift_idea",
        title: "Girl Dinner Cookbook",
        data: { name: "Girl Dinner", amazon_link: "https://example.com" },
      })
    ).toBe(false);
  });
});
