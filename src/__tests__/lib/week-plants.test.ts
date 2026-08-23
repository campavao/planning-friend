import { summarizeWeekPlants, type ScorableItem } from "@/lib/week-plants";
import { WEEKLY_PLANT_GOOD_MIN, WEEKLY_PLANT_TARGET } from "@/lib/plants";

interface MealSpec {
  id?: string;
  title?: string;
  plants?: unknown;
  category?: string;
}

function meal({
  id = "m1",
  title = "Meal",
  plants,
  category = "meal",
}: MealSpec = {}): ScorableItem {
  return { content: { id, title, category, data: { plants } } };
}

const garlic = { source: "garlic", category: "vegetable" };
const onion = { source: "onion", category: "vegetable" };
const lentil = { source: "lentil", category: "legume" };
const wheatNoodles = {
  source: "wheat",
  name: "egg noodles",
  category: "whole_grain",
};
const wheatSoy = { source: "wheat", name: "soy sauce", category: "whole_grain" };

/** N distinct plants, for pushing a week across a band boundary. */
function manyPlants(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    source: `plant-${i}`,
    category: "vegetable" as const,
  }));
}

describe("summarizeWeekPlants", () => {
  it("unions across meals rather than summing them", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [garlic, onion] }),
      meal({ id: "b", plants: [garlic, lentil] }),
    ]);

    expect(summary.count).toBe(3);
    expect(summary.plants.map((p) => p.source).sort()).toEqual([
      "garlic",
      "lentil",
      "onion",
    ]);
  });

  it("collapses two ingredients from one organism into one plant", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [wheatNoodles] }),
      meal({ id: "b", plants: [wheatSoy] }),
    ]);

    expect(summary.count).toBe(1);
  });

  it("credits each plant to the first meal that brought it", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", title: "Monday", plants: [garlic, onion] }),
      meal({ id: "b", title: "Tuesday", plants: [garlic, lentil] }),
    ]);

    expect(summary.meals.map((m) => [m.title, m.newPlants.length])).toEqual([
      ["Monday", 2],
      ["Tuesday", 1],
    ]);
  });

  it("makes the per-meal credits add up to the weekly count", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [garlic, onion] }),
      meal({ id: "b", plants: [garlic, lentil] }),
      meal({ id: "c", plants: [onion] }),
    ]);

    const credited = summary.meals.reduce(
      (sum, m) => sum + m.newPlants.length,
      0,
    );
    expect(credited).toBe(summary.count);
  });

  it("reports a meal that repeats the week as adding nothing", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [garlic, onion] }),
      meal({ id: "b", plants: [onion] }),
    ]);

    expect(summary.meals[1].newPlants).toHaveLength(0);
    // It still holds a plant — it just isn't a new one.
    expect(summary.meals[1].plants).toHaveLength(1);
  });

  it("counts a repeat of the same recipe once", () => {
    const twice = meal({ id: "a", title: "Dal", plants: [lentil, garlic] });
    const summary = summarizeWeekPlants([twice, twice]);

    expect(summary.meals).toHaveLength(1);
    expect(summary.count).toBe(2);
  });

  it("ignores non-meals and quick notes", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [garlic] }),
      meal({ id: "b", category: "event", plants: [onion, lentil] }),
      { content: null },
      {},
    ]);

    expect(summary.count).toBe(1);
    expect(summary.unscoredMeals).toBe(0);
  });

  it("counts meals with no plant data instead of dropping them silently", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [garlic] }),
      meal({ id: "b" }),
      meal({ id: "c", plants: [] }),
    ]);

    expect(summary.count).toBe(1);
    expect(summary.meals).toHaveLength(1);
    expect(summary.unscoredMeals).toBe(2);
  });

  it("drops seasonings, matching what an item page shows", () => {
    const summary = summarizeWeekPlants([
      meal({ id: "a", plants: [garlic, { source: "cumin", category: "seed" }] }),
    ]);

    expect(summary.count).toBe(1);
  });

  it("is empty rather than throwing for a week with nothing in it", () => {
    const summary = summarizeWeekPlants([]);

    expect(summary).toMatchObject({
      count: 0,
      band: "building",
      meals: [],
      unscoredMeals: 0,
    });
  });

  describe("band", () => {
    it("is building below the good minimum", () => {
      const summary = summarizeWeekPlants([
        meal({ plants: manyPlants(WEEKLY_PLANT_GOOD_MIN - 1) }),
      ]);
      expect(summary.band).toBe("building");
    });

    it("is good at the minimum", () => {
      const summary = summarizeWeekPlants([
        meal({ plants: manyPlants(WEEKLY_PLANT_GOOD_MIN) }),
      ]);
      expect(summary.band).toBe("good");
    });

    it("is target at the top of the range and past it", () => {
      expect(
        summarizeWeekPlants([meal({ plants: manyPlants(WEEKLY_PLANT_TARGET) })])
          .band,
      ).toBe("target");
      expect(
        summarizeWeekPlants([
          meal({ plants: manyPlants(WEEKLY_PLANT_TARGET + 5) }),
        ]).band,
      ).toBe("target");
    });
  });
});
