/**
 * Ingredient amounts set in bold. The cases worth pinning are the ones that
 * must not be split: a line without a leading number has nothing to bold, and
 * a half-bolded "Pinch" would look like a bug.
 */

import { splitIngredientAmount } from "@/lib/ingredient-amount";

describe("splitIngredientAmount", () => {
  it.each([
    ["12 oz spaghetti", "12 oz", "spaghetti"],
    ["4 cloves garlic", "4 cloves", "garlic"],
    ["2 lemons", "2", "lemons"],
    ["½ cup cream", "½ cup", "cream"],
    ["1 1/2 cups flour", "1 1/2 cups", "flour"],
    ["1½ tsp salt", "1½ tsp", "salt"],
    ["200g soy yogurt", "200g", "soy yogurt"],
    ["2-3 tbsp olive oil", "2-3 tbsp", "olive oil"],
    ["0.5 l milk", "0.5 l", "milk"],
  ])("splits %s", (line, amount, rest) => {
    expect(splitIngredientAmount(line)).toEqual({ amount, rest });
  });

  it.each(["Fresh basil", "Pinch of saffron", "Black pepper", "Ice (optional)"])(
    "leaves %s whole",
    (line) => {
      expect(splitIngredientAmount(line)).toEqual({ rest: line });
    }
  );

  it("doesn't take a word that merely starts like a unit", () => {
    // "large" starts with "l", a unit, but isn't one.
    expect(splitIngredientAmount("2 large eggs")).toEqual({
      amount: "2",
      rest: "large eggs",
    });
  });

  it("leaves a bare number alone", () => {
    expect(splitIngredientAmount("12")).toEqual({ rest: "12" });
  });
});
