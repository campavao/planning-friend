import { normalizeExtractedData } from "@/lib/gemini";

/**
 * The extraction boundary. Nothing downstream re-validates a fresh extraction —
 * PATCH only guards hand edits — so whatever survives here is what lands in the
 * column.
 */
describe("normalizeExtractedData", () => {
  it("keeps a well-formed meal blob intact", () => {
    const data = {
      ingredients: ["1 cup soy sauce"],
      recipe: ["Mix"],
      effort: "easy",
      spice: "mild",
      plants: [{ source: "soybean", name: "soy sauce", category: "legume" }],
    };
    expect(normalizeExtractedData("meal", data)).toEqual(data);
  });

  it("drops an invented effort rather than storing it", () => {
    const out = normalizeExtractedData("meal", { effort: "trivial" });
    expect(out).not.toHaveProperty("effort");
  });

  it("drops an invented spice level", () => {
    const out = normalizeExtractedData("meal", { spice: "extremely spicy" });
    expect(out).not.toHaveProperty("spice");
  });

  it("accepts every valid effort and spice value", () => {
    for (const effort of ["easy", "medium", "hard"]) {
      expect(normalizeExtractedData("meal", { effort })).toHaveProperty(
        "effort",
        effort
      );
    }
    for (const spice of ["none", "mild", "medium", "hot"]) {
      expect(normalizeExtractedData("meal", { spice })).toHaveProperty(
        "spice",
        spice
      );
    }
  });

  it("strips herb_spice entries the prompt told it not to emit", () => {
    const out = normalizeExtractedData("meal", {
      plants: [
        { source: "basil", category: "herb_spice" },
        { source: "garlic", category: "vegetable" },
      ],
    });
    expect(out.plants).toEqual([{ source: "garlic", category: "vegetable" }]);
  });

  it("dedupes a source the model repeated", () => {
    const out = normalizeExtractedData("meal", {
      plants: [
        { source: "wheat", name: "egg noodles", category: "whole_grain" },
        { source: "wheat", name: "soy sauce", category: "whole_grain" },
      ],
    });
    expect(out.plants).toHaveLength(1);
  });

  it("removes the plants key entirely when nothing valid survives", () => {
    const out = normalizeExtractedData("meal", {
      plants: ["garlic", "onion"], // bare strings, not objects
    });
    expect(out).not.toHaveProperty("plants");
  });

  it("leaves other keys untouched", () => {
    const out = normalizeExtractedData("meal", {
      effort: "nonsense",
      prep_time: "15 min",
      servings: "4",
    });
    expect(out).toEqual({ prep_time: "15 min", servings: "4" });
  });

  it("does not touch non-meal categories", () => {
    // An event has no effort/spice/plants, so nothing should be stripped even
    // if the model hallucinated them onto it.
    const data = { location: "Alamo Drafthouse", effort: "trivial" };
    expect(normalizeExtractedData("event", data)).toEqual(data);
  });

  it("returns an empty object for a non-object blob", () => {
    for (const value of [null, undefined, "meal", 7, ["a"]]) {
      expect(normalizeExtractedData("meal", value)).toEqual({});
    }
  });

  it("does not mutate the input", () => {
    const data = { effort: "bogus", plants: [{ bad: true }] };
    normalizeExtractedData("meal", data);
    expect(data.effort).toBe("bogus");
  });
});
