import {
  PLANT_CATEGORIES,
  countPlants,
  dedupePlants,
  newPlantsAgainst,
  plantKey,
  plantKeySet,
  plantLabel,
  plantsByCategory,
  readPlants,
  unionPlants,
  type Plant,
} from "@/lib/plants";

const wheatFromNoodles: Plant = {
  source: "wheat",
  name: "egg noodles",
  category: "whole_grain",
};
const wheatFromSoy: Plant = {
  source: "wheat",
  name: "soy sauce",
  category: "whole_grain",
};
const soybean: Plant = {
  source: "soybean",
  name: "soy sauce",
  category: "legume",
};
const garlic: Plant = { source: "garlic", category: "vegetable" };
const scallion: Plant = { source: "scallion", category: "vegetable" };
const sesame: Plant = { source: "sesame", category: "seed" };

describe("plantKey", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(plantKey("  Garlic ")).toBe("garlic");
  });

  it("strips a trailing plural so lentil and lentils are one plant", () => {
    expect(plantKey("lentils")).toBe(plantKey("lentil"));
  });

  it("strips -es without mangling the stem", () => {
    expect(plantKey("tomatoes")).toBe("tomato");
  });

  it("leaves a double-s word alone", () => {
    expect(plantKey("watercress")).toBe("watercress");
  });

  it("does not strip the s off a very short word", () => {
    expect(plantKey("os")).toBe("os");
  });
});

describe("dedupePlants", () => {
  it("collapses two ingredients that share a source", () => {
    // The whole point: noodles and soy sauce both carry wheat, so the week
    // gains one whole grain, not two.
    expect(dedupePlants([wheatFromNoodles, wheatFromSoy])).toHaveLength(1);
  });

  it("keeps the first occurrence's display name", () => {
    const [only] = dedupePlants([wheatFromNoodles, wheatFromSoy]);
    expect(only.name).toBe("egg noodles");
  });

  it("keeps genuinely different plants apart", () => {
    expect(dedupePlants([garlic, scallion, sesame])).toHaveLength(3);
  });

  it("treats one ingredient yielding two plants as two", () => {
    // Soy sauce is soybean AND wheat — one ingredient, two sources.
    expect(dedupePlants([soybean, wheatFromSoy])).toHaveLength(2);
  });
});

describe("countPlants", () => {
  it("counts the sample recipe as five", () => {
    expect(
      countPlants([garlic, scallion, soybean, wheatFromSoy, wheatFromNoodles, sesame])
    ).toBe(5);
  });

  it("is zero for an empty list", () => {
    expect(countPlants([])).toBe(0);
  });
});

describe("unionPlants", () => {
  it("is a union, not a sum", () => {
    const monday = [garlic, scallion];
    const tuesday = [garlic, sesame];
    // 2 + 2 = 4 would be wrong; garlic is the same garlic.
    expect(unionPlants([monday, tuesday])).toHaveLength(3);
  });

  it("handles an empty week", () => {
    expect(unionPlants([])).toEqual([]);
  });

  it("ignores items that contribute nothing", () => {
    expect(unionPlants([[garlic], [], [garlic]])).toHaveLength(1);
  });
});

describe("newPlantsAgainst", () => {
  it("returns only what the week does not already have", () => {
    const week = plantKeySet([garlic, wheatFromNoodles]);
    const added = newPlantsAgainst(
      [garlic, scallion, soybean, wheatFromSoy, sesame],
      week
    );
    expect(added.map((p) => p.source).sort()).toEqual([
      "scallion",
      "sesame",
      "soybean",
    ]);
  });

  it("returns everything when the week is empty", () => {
    expect(newPlantsAgainst([garlic, sesame], new Set())).toHaveLength(2);
  });

  it("returns nothing when the week already covers the item", () => {
    expect(newPlantsAgainst([garlic], plantKeySet([garlic]))).toEqual([]);
  });

  it("matches across plural forms", () => {
    const week = plantKeySet([{ source: "lentils", category: "legume" }]);
    expect(newPlantsAgainst([{ source: "lentil", category: "legume" }], week))
      .toEqual([]);
  });
});

describe("readPlants", () => {
  it("reads a well-formed list", () => {
    expect(
      readPlants([{ source: "garlic", category: "vegetable" }])
    ).toEqual([{ source: "garlic", category: "vegetable" }]);
  });

  it("returns empty for anything that is not an array", () => {
    for (const value of [undefined, null, "garlic", 7, {}]) {
      expect(readPlants(value)).toEqual([]);
    }
  });

  it("drops entries with an unknown category rather than throwing", () => {
    // "herb_spice" is exactly the case that matters: an older extraction may
    // have emitted it, and it must not count.
    expect(
      readPlants([
        { source: "basil", category: "herb_spice" },
        { source: "garlic", category: "vegetable" },
      ])
    ).toEqual([{ source: "garlic", category: "vegetable" }]);
  });

  it("drops entries with no source", () => {
    expect(readPlants([{ source: "   ", category: "vegetable" }])).toEqual([]);
  });

  it("drops non-object entries", () => {
    expect(readPlants(["garlic", null, 3])).toEqual([]);
  });

  it("omits a display name identical to the source", () => {
    const [only] = readPlants([
      { source: "garlic", name: "garlic", category: "vegetable" },
    ]);
    expect(only).not.toHaveProperty("name");
  });

  it("dedupes on the way in", () => {
    expect(
      readPlants([
        { source: "wheat", name: "egg noodles", category: "whole_grain" },
        { source: "Wheat", name: "soy sauce", category: "whole_grain" },
      ])
    ).toHaveLength(1);
  });
});

describe("plantsByCategory", () => {
  it("groups in the declared category order and omits empty groups", () => {
    const groups = plantsByCategory([sesame, soybean, garlic]);
    expect(groups.map((g) => g.category)).toEqual([
      "vegetable",
      "legume",
      "seed",
    ]);
  });

  it("labels each group", () => {
    const [first] = plantsByCategory([garlic]);
    expect(first.label).toBe("Vegetables");
  });
});

describe("plantLabel", () => {
  it("prefers what the recipe called it", () => {
    expect(plantLabel(wheatFromNoodles)).toBe("egg noodles");
  });

  it("falls back to the source", () => {
    expect(plantLabel(garlic)).toBe("garlic");
  });
});

describe("PLANT_CATEGORIES", () => {
  it("excludes herbs and spices", () => {
    expect(PLANT_CATEGORIES).not.toContain("herb_spice");
  });

  it("is the six groups from the dietitian guide", () => {
    expect([...PLANT_CATEGORIES]).toEqual([
      "vegetable",
      "fruit",
      "whole_grain",
      "legume",
      "nut",
      "seed",
    ]);
  });
});
