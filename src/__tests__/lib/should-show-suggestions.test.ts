/**
 * The suggestion-strip gate (PLA-42).
 *
 * This exists because the toggle shipped broken. The condition was written
 * inline as `!hidden && empty || hasPicks`, and since `&&` binds tighter than
 * `||` that means `(!hidden && empty) || hasPicks` — so every day that had
 * picks ignored the toggle completely, which is exactly the case a user hits
 * first. The comment above it claimed the opposite.
 */

import { shouldShowSuggestions } from "@/lib/plan-dates";

describe("shouldShowSuggestions", () => {
  describe("when the user has turned suggestions off", () => {
    it("hides them on a day that has picks", () => {
      // The regression: this returned true, because `|| hasPicks` escaped
      // the toggle entirely.
      expect(shouldShowSuggestions(true, 2, 5)).toBe(false);
    });

    it("hides them on an empty day too", () => {
      // Off means off. An empty day would otherwise keep the strip to explain
      // itself, and "mostly off" is not a setting.
      expect(shouldShowSuggestions(true, 0, 0)).toBe(false);
      expect(shouldShowSuggestions(true, 0, 3)).toBe(false);
    });
  });

  describe("when suggestions are on", () => {
    it("shows them when there are picks", () => {
      expect(shouldShowSuggestions(false, 2, 5)).toBe(true);
    });

    it("keeps the strip on an empty day with no picks, so it can explain itself", () => {
      expect(shouldShowSuggestions(false, 0, 0)).toBe(true);
    });

    it("hides it on a day that is already planned and has nothing to add", () => {
      expect(shouldShowSuggestions(false, 3, 0)).toBe(false);
    });
  });
});
