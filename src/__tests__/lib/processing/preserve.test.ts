import {
  contentWeight,
  isCollapse,
  hasSalvageableContent,
  isLowValueResult,
  losesLocation,
  mergeOntoExisting,
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

describe("collapse into a title echo", () => {
  // The real one: 21 ingredients and 26 steps replaced by three "ingredients"
  // that were the words of the recipe's own title.
  const teriyaki = {
    status: "completed",
    category: "meal",
    title: "Teriyaki Chicken with Pineapple and Muenster Cheese & Macaroni Salad",
    data: {
      ingredients: Array.from({ length: 21 }, (_, i) => `ingredient ${i}`),
      recipe: Array.from({ length: 26 }, (_, i) => `step ${i}`),
    },
  } as unknown as Pick<Content, "status" | "category" | "title" | "data">;

  const titleEcho = {
    category: "meal",
    title: "Teriyaki Chicken with Pineapple and Muenster Cheese",
    data: { ingredients: ["Teriyaki Chicken", "Pineapple", "Muenster Cheese"], recipe: [] },
  };

  it("weighs arrays by length, not presence", () => {
    expect(contentWeight(teriyaki.data)).toBe(47);
    expect(contentWeight(titleEcho.data)).toBe(3);
  });

  it("catches the collapse that isLowValueResult misses", () => {
    expect(isLowValueResult(titleEcho)).toBe(false); // three is more than none
    expect(isCollapse(teriyaki.data, titleEcho)).toBe(true);
    expect(shouldPreserveExisting(teriyaki, titleEcho)).toBe(true);
  });

  it("allows ordinary re-extraction variance on a small recipe", () => {
    // 7 items -> 4 is below the floor: normal, and must not be blocked.
    const small = {
      status: "completed", category: "meal", title: "Caesar Crunchwraps",
      data: { ingredients: ["a", "b", "c", "d"], recipe: ["1", "2", "3"] },
    } as unknown as Pick<Content, "status" | "category" | "title" | "data">;
    expect(
      shouldPreserveExisting(small, {
        category: "meal", title: "Caesar Crunchwrap",
        data: { ingredients: ["a", "b"], recipe: ["1", "2"] },
      })
    ).toBe(false);
  });

  it("allows a large recipe to shrink moderately", () => {
    expect(
      shouldPreserveExisting(teriyaki, {
        category: "meal", title: "Teriyaki Chicken",
        data: {
          ingredients: Array.from({ length: 14 }, (_, i) => `i${i}`),
          recipe: Array.from({ length: 16 }, (_, i) => `s${i}`),
        },
      })
    ).toBe(false);
  });

  it("allows a re-extraction that grows", () => {
    expect(
      shouldPreserveExisting(teriyaki, {
        category: "meal", title: "Teriyaki Chicken",
        data: {
          ingredients: Array.from({ length: 25 }, (_, i) => `i${i}`),
          recipe: Array.from({ length: 30 }, (_, i) => `s${i}`),
        },
      })
    ).toBe(false);
  });
});

// A photo of a hotel receipt: a place, two dates, a reference. Everything that
// matters is small in number, which is why the collapse floor never saw it.
const savedBooking = {
  status: "completed",
  category: "travel",
  title: "The Study at Yale",
  data: {
    location: "1157 Chapel St, New Haven, CT",
    type: "hotel",
    description: "Two nights, king room.",
    website: "https://thestudyatyale.com",
    sections: [
      { label: "Confirmation", value: "8842-1173" },
      { label: "Check-in", value: "Sept 5, 4:00 PM" },
    ],
  },
} as unknown as Pick<Content, "status" | "category" | "title" | "data">;

describe("losesLocation", () => {
  it("catches a booking re-read as a bare description", () => {
    expect(
      losesLocation(savedBooking.data, {
        category: "other",
        title: "Hotel receipt",
        data: { description: "A receipt for a hotel stay." },
      })
    ).toBe(true);
  });

  it("passes a re-extraction that still knows where the place is", () => {
    expect(
      losesLocation(savedBooking.data, {
        category: "travel",
        title: "The Study at Yale",
        data: { location: "New Haven, CT" },
      })
    ).toBe(false);
  });

  it("ignores a row that never had a location", () => {
    expect(
      losesLocation(
        { ingredients: ["a", "b"], recipe: ["1"] },
        { category: "meal", title: "Soup", data: { recipe: ["1"] } }
      )
    ).toBe(false);
  });

  it("lets a genuinely richer result through even without a location", () => {
    expect(
      losesLocation(savedBooking.data, {
        category: "meal",
        title: "Lobster Roll",
        data: {
          ingredients: ["lobster", "brioche", "butter", "chives"],
          recipe: ["Warm the butter", "Toss the lobster", "Fill the roll"],
        },
      })
    ).toBe(false);
  });

  it("treats a blank location as no location", () => {
    expect(
      losesLocation(savedBooking.data, {
        category: "travel",
        title: "The Study at Yale",
        data: { location: "   " },
      })
    ).toBe(true);
  });
});

describe("shouldPreserveExisting — bookings", () => {
  it("keeps the receipt when the re-analysis drops everything printed on it", () => {
    expect(
      shouldPreserveExisting(savedBooking, {
        category: "other",
        title: "Hotel receipt",
        data: { description: "A receipt for a hotel stay." },
      })
    ).toBe(true);
  });

  it("still allows a better read of the same receipt", () => {
    expect(
      shouldPreserveExisting(savedBooking, {
        category: "travel",
        title: "The Study at Yale",
        data: {
          location: "1157 Chapel St, New Haven, CT 06511",
          website: "https://thestudyatyale.com",
          destination_city: "New Haven",
          sections: [{ label: "Confirmation", value: "8842-1173" }],
        },
      })
    ).toBe(false);
  });
});

/**
 * A re-extraction is a fresh read, not a diff. A field it happens not to find
 * comes back absent, and writing that over the row turns "I did not see a
 * price" into "there is no price".
 */
const savedFind = {
  category: "gift_idea",
  data: {
    name: "Stanley Quencher H2.0",
    cost: "$45.00",
    description: "The tumbler everyone has.",
    purchase_link: "https://stanley1913.com/products/quencher",
    amazon_link: "https://www.amazon.com/s?k=Stanley+Quencher",
    manually_edited_at: "2026-08-01T12:00:00.000Z",
  },
} as unknown as Pick<Content, "category" | "data">;

describe("mergeOntoExisting", () => {
  it("keeps a price the new read did not find", () => {
    const merged = mergeOntoExisting(savedFind, {
      category: "gift_idea",
      title: "Stanley Quencher H2.0",
      data: {
        name: "Stanley Quencher H2.0 FlowState Tumbler",
        description: "40oz insulated tumbler with a handle.",
      },
    });

    expect(merged.cost).toBe("$45.00");
    expect(merged.amazon_link).toBe(
      "https://www.amazon.com/s?k=Stanley+Quencher"
    );
    // The fresh read still wins wherever it actually said something.
    expect(merged.name).toBe("Stanley Quencher H2.0 FlowState Tumbler");
    expect(merged.description).toBe("40oz insulated tumbler with a handle.");
  });

  it("keeps the manual-edit stamp a regenerate used to erase", () => {
    const merged = mergeOntoExisting(savedFind, {
      category: "gift_idea",
      title: "Stanley Quencher",
      data: { name: "Stanley Quencher" },
    });
    expect(merged.manually_edited_at).toBe("2026-08-01T12:00:00.000Z");
  });

  it("treats empty string, null and empty array as not-found", () => {
    const merged = mergeOntoExisting(savedFind, {
      category: "gift_idea",
      title: "Stanley Quencher",
      data: { cost: "", purchase_link: null, name: "   " },
    });
    expect(merged.cost).toBe("$45.00");
    expect(merged.purchase_link).toBe(
      "https://stanley1913.com/products/quencher"
    );
    expect(merged.name).toBe("Stanley Quencher H2.0");
  });

  it("does not carry fields across a change of category", () => {
    const merged = mergeOntoExisting(savedFind, {
      category: "meal",
      title: "Iced Coffee",
      data: { ingredients: ["coffee", "ice"] },
    });
    expect(merged).toEqual({ ingredients: ["coffee", "ice"] });
    expect(merged).not.toHaveProperty("cost");
  });

  it("returns the new result untouched when there is nothing to merge with", () => {
    const data = { cost: "$12" };
    expect(mergeOntoExisting(null, { category: "gift_idea", data })).toEqual(
      data
    );
    expect(
      mergeOntoExisting(
        { category: "gift_idea", data: undefined } as unknown as Pick<
          Content,
          "category" | "data"
        >,
        { category: "gift_idea", data }
      )
    ).toEqual(data);
  });
});

describe("mergeOntoExisting — sections", () => {
  const withSections = {
    category: "event",
    data: {
      location: "Navy Pier, Chicago",
      sections: [
        { label: "Parking", value: "Lot B, $18" },
        { label: "Seats", value: "Row F" },
      ],
    },
  } as unknown as Pick<Content, "category" | "data">;

  it("keeps the rows the owner typed", () => {
    const merged = mergeOntoExisting(withSections, {
      category: "event",
      title: "Lobster Fest",
      data: { location: "Navy Pier, Chicago" },
    });
    expect(merged.sections).toEqual(withSections.data.sections);
  });

  it("appends what the extraction found without duplicating a label", () => {
    const merged = mergeOntoExisting(withSections, {
      category: "event",
      title: "Lobster Fest",
      data: {
        sections: [
          { label: "seats", value: "Row A" },
          { label: "Doors", value: "6:00 PM" },
        ],
      },
    });
    expect(merged.sections).toEqual([
      { label: "Parking", value: "Lot B, $18" },
      { label: "Seats", value: "Row F" },
      { label: "Doors", value: "6:00 PM" },
    ]);
  });

  it("takes the extraction's sections when the row had none", () => {
    const merged = mergeOntoExisting(
      { category: "event", data: { location: "x" } } as unknown as Pick<
        Content,
        "category" | "data"
      >,
      {
        category: "event",
        title: "Lobster Fest",
        data: { sections: [{ label: "Doors", value: "6:00 PM" }] },
      }
    );
    expect(merged.sections).toEqual([{ label: "Doors", value: "6:00 PM" }]);
  });

  it("leaves no sections key when neither side has any", () => {
    const merged = mergeOntoExisting(
      { category: "event", data: { location: "x" } } as unknown as Pick<
        Content,
        "category" | "data"
      >,
      { category: "event", title: "Lobster Fest", data: { location: "y" } }
    );
    expect(merged).not.toHaveProperty("sections");
  });

  it("caps a merged list at what the editor will accept", () => {
    const many = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({
        label: `${prefix}${i}`,
        value: "v",
      }));
    const merged = mergeOntoExisting(
      { category: "event", data: { sections: many(18, "own") } } as unknown as Pick<
        Content,
        "category" | "data"
      >,
      { category: "event", title: "x", data: { sections: many(6, "new") } }
    );
    expect(merged.sections).toHaveLength(20);
  });
});

describe("the texted-in message is context, not content", () => {
  it("does not count towards a result having substance", () => {
    expect(
      isLowValueResult({
        category: "other",
        title: "Photo",
        data: { source_message: "hotel for the Des Moines trip" },
      })
    ).toBe(true);
  });

  it("survives a regenerate", () => {
    const merged = mergeOntoExisting(
      {
        category: "travel",
        data: {
          location: "Des Moines, IA",
          source_message: "hotel for the Des Moines trip",
        },
      } as unknown as Pick<Content, "category" | "data">,
      {
        category: "travel",
        title: "Embassy Suites",
        data: { location: "101 East Locust Street, Des Moines, IA" },
      }
    );
    expect(merged.source_message).toBe("hotel for the Des Moines trip");
  });
});
