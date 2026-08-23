import { canDerive, readDerived } from "@/lib/derive-attributes";

describe("canDerive", () => {
  it("needs some recipe text to work from", () => {
    expect(canDerive({ ingredients: [], recipe: [] })).toBe(false);
    expect(canDerive({ ingredients: ["2 oz gin"], recipe: [] })).toBe(true);
    expect(canDerive({ ingredients: [], recipe: ["Shake"] })).toBe(true);
  });
});

describe("readDerived", () => {
  it("keeps well-formed values", () => {
    const out = readDerived("meal", {
      effort: "medium",
      spice: "mild",
      equipment: ["Slow cooker", " Spatula "],
      plants: [{ source: "garlic", category: "vegetable" }],
    });
    expect(out.effort).toBe("medium");
    expect(out.spice).toBe("mild");
    expect(out.equipment).toEqual(["Slow cooker", "Spatula"]);
    expect(out.plants?.map((p) => p.source)).toEqual(["garlic"]);
  });

  it("drops an invented enum rather than correcting it", () => {
    // A wrong spice level renders as a confident lie; an absent one renders
    // as nothing, which is honest.
    const out = readDerived("meal", { effort: "trivial", spice: "nuclear" });
    expect(out.effort).toBeUndefined();
    expect(out.spice).toBeUndefined();
  });

  it("applies the seasoning denylist to derived plants", () => {
    const out = readDerived("meal", {
      plants: [
        { source: "garlic", category: "vegetable" },
        { source: "cumin", category: "seed" },
        { source: "grape", name: "Champagne", category: "fruit" },
      ],
    });
    expect(out.plants?.map((p) => p.source)).toEqual(["garlic"]);
  });

  it("gives a drink equipment but not plants or effort", () => {
    const out = readDerived("drink", {
      equipment: ["Shaker"],
      effort: "easy",
      plants: [{ source: "lemon", category: "fruit" }],
    });
    expect(out.equipment).toEqual(["Shaker"]);
    expect(out.effort).toBeUndefined();
    expect(out.plants).toBeUndefined();
  });

  it("returns nothing for a null or junk response", () => {
    expect(readDerived("meal", null)).toEqual({});
    expect(readDerived("meal", { plants: "garlic", equipment: 3 })).toEqual({});
  });

  it("omits empty collections rather than writing empty arrays", () => {
    const out = readDerived("meal", { plants: [], equipment: [] });
    expect(out.plants).toBeUndefined();
    expect(out.equipment).toBeUndefined();
  });
});
