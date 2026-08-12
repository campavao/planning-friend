/**
 * The `data` blob round trip.
 *
 * The bug worth catching here is not "does the schema accept a valid meal" — it
 * is "does editing one field quietly take another field with it". So most of
 * these tests start from a realistic stored blob, change exactly one thing, and
 * assert the whole object equals the original with that one change applied.
 */

import {
  applyContentDataPatch,
  diffContentData,
  hasManualEdits,
  MANUAL_EDIT_STAMP_KEY,
  MAX_CONTENT_DATA_CHARS,
  updateContentBodySchema,
} from "@/lib/schemas/content";

// A meal as the extraction actually leaves it, plus one key nothing writes any
// more — the kind of thing a stricter schema would silently drop.
const STORED_MEAL = {
  ingredients: ["2 cups flour", "1 tsp salt", "3 eggs"],
  recipe: [
    "Mix the dry ingredients",
    "Beat in the eggs",
    "Bake for 40 minutes",
  ],
  prep_time: "15 min",
  cook_time: "40 min",
  servings: "4",
  source_notes: "left behind by an older extraction",
};

const STORED_DATE_IDEA = {
  location: "1234 W Fulton St, Chicago, IL",
  type: "dinner",
  price_range: "$$$",
  description: "Tasting menu, worth the wait",
  website: "https://example-restaurant.com",
  reservation_link: "https://resy.com/cities/chi/example",
  image_url: "https://cdn.example.com/photo.jpg",
};

function expectOk(result: ReturnType<typeof applyContentDataPatch>) {
  if (!result.success) {
    throw new Error(`expected the patch to apply, got: ${result.error}`);
  }
  return result.data;
}

describe("applyContentDataPatch — untouched keys", () => {
  it("leaves every other key alone when only the ingredients change", () => {
    const edited = ["2 cups flour", "1 tsp fine salt", "3 eggs"];

    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { ingredients: edited })
    );

    expect(data).toEqual({ ...STORED_MEAL, ingredients: edited });
  });

  it("keeps a key from an older extraction that the patch never mentions", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { servings: "6" })
    );

    expect(data.source_notes).toBe("left behind by an older extraction");
  });

  it("carries an unknown key through when the patch does contain one", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { wine_pairing: "Chianti" })
    );

    expect(data).toEqual({ ...STORED_MEAL, wine_pairing: "Chianti" });
  });

  it("does not resurrect a field the stored blob never had", () => {
    const data = expectOk(
      applyContentDataPatch("meal", { ingredients: ["flour"] }, {
        ingredients: ["flour", "water"],
      })
    );

    expect(data).toEqual({ ingredients: ["flour", "water"] });
    expect("prep_time" in data).toBe(false);
  });

  it("treats a missing stored blob as an empty one", () => {
    const data = expectOk(
      applyContentDataPatch("meal", undefined, { servings: "2" })
    );

    expect(data).toEqual({ servings: "2" });
  });
});

describe("applyContentDataPatch — list editing", () => {
  it("persists a reordered list in the order it was given", () => {
    const reordered = ["3 eggs", "2 cups flour", "1 tsp salt"];

    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { ingredients: reordered })
    );

    expect(data.ingredients).toEqual(reordered);
  });

  it("persists an added step", () => {
    const withStep = [...STORED_MEAL.recipe, "Cool on a rack"];

    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { recipe: withStep })
    );

    expect(data).toEqual({ ...STORED_MEAL, recipe: withStep });
  });

  it("persists a removed ingredient", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, {
        ingredients: ["2 cups flour", "3 eggs"],
      })
    );

    expect(data.ingredients).toEqual(["2 cups flour", "3 eggs"]);
  });

  it("drops the blank row an editor leaves behind rather than rejecting it", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, {
        ingredients: ["2 cups flour", "   ", ""],
      })
    );

    expect(data.ingredients).toEqual(["2 cups flour"]);
  });

  it("trims the lines it keeps", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, {
        recipe: ["  Mix the dry ingredients  "],
      })
    );

    expect(data.recipe).toEqual(["Mix the dry ingredients"]);
  });
});

describe("applyContentDataPatch — clearing a field", () => {
  it("removes a field blanked in the editor, and only that field", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { prep_time: "" })
    );

    expect("prep_time" in data).toBe(false);
    expect(data).toEqual({
      ingredients: STORED_MEAL.ingredients,
      recipe: STORED_MEAL.recipe,
      cook_time: "40 min",
      servings: "4",
      source_notes: STORED_MEAL.source_notes,
    });
  });

  it("treats null the same as a blank", () => {
    const data = expectOk(
      applyContentDataPatch("meal", STORED_MEAL, { cook_time: null })
    );

    expect("cook_time" in data).toBe(false);
  });

  it("clears a select-backed field, which has no empty member of its own", () => {
    const data = expectOk(
      applyContentDataPatch("date_idea", STORED_DATE_IDEA, { price_range: "" })
    );

    expect("price_range" in data).toBe(false);
    expect(data.type).toBe("dinner");
  });

  it("keeps a boolean false, which is a value and not a blank", () => {
    const data = expectOk(
      applyContentDataPatch(
        "event",
        { requires_ticket: true, location: "The Metro" },
        { requires_ticket: false }
      )
    );

    expect(data).toEqual({ requires_ticket: false, location: "The Metro" });
  });
});

describe("applyContentDataPatch — rejections", () => {
  function expectRejected(result: ReturnType<typeof applyContentDataPatch>) {
    expect(result.success).toBe(false);
    return result.success ? "" : result.error;
  }

  it("rejects a list sent as a bare string", () => {
    expectRejected(
      applyContentDataPatch("meal", STORED_MEAL, { ingredients: "flour" })
    );
  });

  it("rejects a list of things that are not lines", () => {
    const error = expectRejected(
      applyContentDataPatch("meal", STORED_MEAL, { ingredients: [1, 2] })
    );

    expect(error).toContain("ingredients");
  });

  it("rejects a nested object where a line belongs", () => {
    expectRejected(
      applyContentDataPatch("meal", STORED_MEAL, {
        recipe: [{ step: "Mix it" }],
      })
    );
  });

  it("rejects a value outside a select's options", () => {
    const error = expectRejected(
      applyContentDataPatch("date_idea", STORED_DATE_IDEA, {
        price_range: "cheap",
      })
    );

    expect(error).toContain("price_range");
  });

  it("rejects a javascript: link, which would run on click", () => {
    expectRejected(
      applyContentDataPatch("date_idea", STORED_DATE_IDEA, {
        website: "javascript:alert(1)",
      })
    );
  });

  it("rejects a blob larger than the cap", () => {
    const error = expectRejected(
      applyContentDataPatch("meal", STORED_MEAL, {
        description: "x".repeat(MAX_CONTENT_DATA_CHARS + 1),
      })
    );

    expect(error).toBeTruthy();
  });

  it("rejects a time longer than any real prep time", () => {
    expectRejected(
      applyContentDataPatch("meal", STORED_MEAL, {
        prep_time: "x".repeat(501),
      })
    );
  });
});

describe("applyContentDataPatch — links", () => {
  it("accepts an https link unchanged, trailing slash and all", () => {
    const data = expectOk(
      applyContentDataPatch("date_idea", STORED_DATE_IDEA, {
        website: "https://example-restaurant.com/menu",
      })
    );

    expect(data.website).toBe("https://example-restaurant.com/menu");
  });

  it("does not rewrite a bare origin the URL parser would normalise", () => {
    const data = expectOk(
      applyContentDataPatch("date_idea", STORED_DATE_IDEA, {
        website: "https://example-restaurant.com",
      })
    );

    // new URL().toString() would hand back ".com/" here — a save that touched a
    // different field must not quietly rewrite this one.
    expect(data.website).toBe("https://example-restaurant.com");
  });

  it("assumes https for the scheme-less link people actually paste", () => {
    const data = expectOk(
      applyContentDataPatch("date_idea", STORED_DATE_IDEA, {
        menu_link: "example-restaurant.com/menu",
      })
    );

    expect(data.menu_link).toBe("https://example-restaurant.com/menu");
  });
});

describe("applyContentDataPatch — category switching", () => {
  it("validates against the category the item is becoming", () => {
    // "cocktail" is a drink type and not a travel one.
    const asDrink = applyContentDataPatch("drink", STORED_DATE_IDEA, {
      type: "cocktail",
    });
    expect(asDrink.success).toBe(true);

    const asTravel = applyContentDataPatch("travel", STORED_DATE_IDEA, {
      type: "cocktail",
    });
    expect(asTravel.success).toBe(false);
  });

  it("keeps the keys the new shape has no field for", () => {
    // A recipe re-filed as a drink: the ingredients still mean what they meant,
    // and cook_time/servings stay put rather than being thrown away.
    const data = expectOk(
      applyContentDataPatch("drink", STORED_MEAL, { type: "smoothie" })
    );

    expect(data).toEqual({ ...STORED_MEAL, type: "smoothie" });
  });
});

describe("diffContentData", () => {
  it("sends only what changed", () => {
    const edited = { ...STORED_MEAL, servings: "6" };

    expect(diffContentData(STORED_MEAL, edited)).toEqual({ servings: "6" });
  });

  it("sends nothing when nothing changed", () => {
    expect(diffContentData(STORED_MEAL, { ...STORED_MEAL })).toEqual({});
  });

  it("does not count an empty box the editor drew for a missing field", () => {
    // The form renders every field for the category; the ones the extraction
    // never filled come back as "". That is not an edit.
    const edited = { ...STORED_MEAL, description: "" };

    expect(diffContentData(STORED_MEAL, edited)).toEqual({});
  });

  it("sends a blanked field as an empty string so the route removes it", () => {
    const edited = { ...STORED_MEAL, prep_time: "" };

    expect(diffContentData(STORED_MEAL, edited)).toEqual({ prep_time: "" });
  });

  it("notices a reorder even though the lines are the same", () => {
    const reordered = ["3 eggs", "2 cups flour", "1 tsp salt"];

    expect(
      diffContentData(STORED_MEAL, { ...STORED_MEAL, ingredients: reordered })
    ).toEqual({ ingredients: reordered });
  });

  it("leaves a stored value the editor merely displayed out of the patch", () => {
    // A numeric servings is shown as "4" in a text box. Untouched, it must not
    // be rewritten as a string — the baseline is what the form was seeded with.
    const stored = { servings: 4, ingredients: ["flour"] };

    expect(diffContentData(stored, { ...stored })).toEqual({});
  });
});

describe("diff then apply", () => {
  it("round-trips an edit and moves nothing else", () => {
    // Exactly what the page does: seed the form, change three things, send the
    // difference, merge it server-side.
    const edited = {
      ...STORED_MEAL,
      ingredients: ["3 eggs", "2 cups flour", "1 tsp fine salt", "1 cup milk"],
      prep_time: "",
      servings: "6",
    };

    const patch = diffContentData(STORED_MEAL, edited);
    const data = expectOk(applyContentDataPatch("meal", STORED_MEAL, patch));

    expect(data).toEqual({
      ingredients: edited.ingredients,
      recipe: STORED_MEAL.recipe,
      cook_time: "40 min",
      servings: "6",
      source_notes: STORED_MEAL.source_notes,
    });
  });

  it("survives a value the schema would reject, as long as nobody touched it", () => {
    // An old extraction left an unusable price range. Editing the description
    // must still save — the bad value is never sent, so it never gets judged.
    const stored = { ...STORED_DATE_IDEA, price_range: "cheap" };
    const edited = { ...stored, description: "Still worth the wait" };

    const patch = diffContentData(stored, edited);
    expect(patch).toEqual({ description: "Still worth the wait" });

    const data = expectOk(applyContentDataPatch("date_idea", stored, patch));
    expect(data.price_range).toBe("cheap");
  });
});

describe("updateContentBodySchema", () => {
  it("accepts a star on its own", () => {
    const parsed = updateContentBodySchema.safeParse({ is_favorite: true });
    expect(parsed.success).toBe(true);
  });

  it("rejects a blank title rather than storing one", () => {
    const parsed = updateContentBodySchema.safeParse({ title: "   " });
    expect(parsed.success).toBe(false);
  });

  it("rejects a category it has never heard of", () => {
    const parsed = updateContentBodySchema.safeParse({ category: "brunch" });
    expect(parsed.success).toBe(false);
  });

  it("rejects data sent as anything but an object", () => {
    expect(updateContentBodySchema.safeParse({ data: "flour" }).success).toBe(
      false
    );
    expect(updateContentBodySchema.safeParse({ data: [1, 2] }).success).toBe(
      false
    );
  });
});

describe("hasManualEdits", () => {
  it("is false for a freshly extracted blob", () => {
    expect(hasManualEdits(STORED_MEAL)).toBe(false);
  });

  it("is true once the route has stamped it", () => {
    expect(
      hasManualEdits({
        ...STORED_MEAL,
        [MANUAL_EDIT_STAMP_KEY]: "2026-08-11T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("is false for a missing blob", () => {
    expect(hasManualEdits(undefined)).toBe(false);
  });
});
