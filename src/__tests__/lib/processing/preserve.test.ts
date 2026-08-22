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

  it("protects a row regardless of status, because content is the point", () => {
    // This assertion used to demand the opposite, which is what made the guard
    // inert: reprocess flips the row to "processing" before the pipeline runs,
    // so requiring "completed" meant the guard never fired for the one job it
    // existed to do.
    expect(hasSalvageableContent({ ...savedRecipe, status: "processing" })).toBe(true);
    expect(hasSalvageableContent({ ...savedRecipe, status: "failed" })).toBe(true);
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

describe("substance, not category", () => {
  const savedCocktail = {
    status: "completed",
    category: "drink",
    title: "Gin Sour Cocktail",
    data: {
      ingredients: ["2 oz gin", "1 oz lemon juice"],
      recipe: ["Shake with ice", "Strain"],
    },
  } as unknown as Pick<Content, "status" | "category" | "title" | "data">;

  it("flags a correctly-categorised result that carries no content", () => {
    // The real one: liquor.com failed to scrape, and the model returned a
    // confident drink with the right title, a type, and a description it
    // inferred from the URL. Category-based checks sail straight past this.
    expect(
      isLowValueResult({
        category: "drink",
        title: "Gin Sour Cocktail",
        data: {
          type: "cocktail",
          description:
            "A recipe for a classic Gin Sour cocktail, typically found on liquor.com.",
        },
      })
    ).toBe(true);
  });

  it("preserves the saved cocktail against that empty result", () => {
    expect(
      shouldPreserveExisting(savedCocktail, {
        category: "drink",
        title: "Gin Sour Cocktail",
        data: { type: "cocktail", description: "A recipe for a classic Gin Sour." },
      })
    ).toBe(true);
  });

  it("treats an empty array as no content", () => {
    expect(
      isLowValueResult({
        category: "meal",
        title: "Something",
        data: { ingredients: [], recipe: [], description: "words" },
      })
    ).toBe(true);
  });

  it("lets a result with one real field through", () => {
    expect(
      isLowValueResult({
        category: "drink",
        title: "Gin Sour Cocktail",
        data: { type: "cocktail", ingredients: ["2 oz gin"] },
      })
    ).toBe(false);
  });

  it("still lets a first save record its own emptiness", () => {
    expect(
      shouldPreserveExisting(null, { category: "drink", title: "X", data: {} })
    ).toBe(false);
  });
});

describe("timings and ratings are not substance", () => {
  it("flags empty arrays dressed up with a prep time and difficulty", () => {
    // The actual second attempt at the Gin Sour. Every content array empty,
    // but prep_time and difficulty populated — a guess needing no source.
    expect(
      isLowValueResult({
        category: "drink",
        title: "Gin Sour Cocktail",
        data: {
          type: "cocktail",
          description: "A classic sour.",
          prep_time: "5 minutes",
          difficulty: "easy",
          ingredients: [],
          recipe: [],
          equipment: [],
        },
      })
    ).toBe(true);
  });

  it("counts one real ingredient as substance", () => {
    expect(
      isLowValueResult({
        category: "drink",
        title: "Gin Sour Cocktail",
        data: { prep_time: "5 minutes", ingredients: ["2 oz gin"] },
      })
    ).toBe(false);
  });

  it("counts a location as substance for a non-recipe item", () => {
    expect(
      isLowValueResult({
        category: "date_idea",
        title: "Rooftop bar",
        data: { description: "Nice views", location: "123 Example St" },
      })
    ).toBe(false);
  });
});

describe("the guard fires during an actual reprocess", () => {
  // The reprocess route sets status to "processing" before dispatching, so the
  // row a processor reads back is NEVER "completed". Requiring that status
  // made the guard inert for its entire reason to exist.
  const midReprocess = {
    status: "processing",
    category: "meal",
    title: "Crispy Skin Chicken Thighs with Pan Sauce",
    data: { ingredients: ["4 chicken thighs"], recipe: ["Sear skin-side down"] },
  } as unknown as Pick<Content, "status" | "category" | "title" | "data">;

  it("protects a row that reprocess has already flipped to processing", () => {
    expect(hasSalvageableContent(midReprocess)).toBe(true);
    expect(
      shouldPreserveExisting(midReprocess, {
        category: "meal",
        title: "Restaurant-worthy chicken at home",
        data: { description: "A chicken dish." },
      })
    ).toBe(true);
  });

  it("does not protect a row mid first ingest, which has no content yet", () => {
    expect(
      hasSalvageableContent({
        status: "processing",
        category: "other",
        title: "Processing...",
        data: {},
      } as unknown as Pick<Content, "status" | "category" | "title" | "data">)
    ).toBe(false);
  });
});
