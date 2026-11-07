/**
 * The suggestion gate (PLA-42).
 *
 * This exists because the toggle once shipped broken. The condition was written
 * inline as `!hidden && empty || hasPicks`, and since `&&` binds tighter than
 * `||` that means `(!hidden && empty) || hasPicks` — so every day that had
 * picks ignored the toggle completely, which is exactly the case a user hits
 * first. Now only empty days show an idea at all.
 */

import { shouldShowSuggestions } from "@/lib/plan-dates";

describe("shouldShowSuggestions", () => {
  describe("when the user has turned suggestions off", () => {
    it("hides them on an empty day", () => {
      // Off means off, even where an idea would fill a gap.
      expect(shouldShowSuggestions(true, 0)).toBe(false);
    });

    it("hides them on a planned day", () => {
      expect(shouldShowSuggestions(true, 2)).toBe(false);
    });
  });

  describe("when suggestions are on", () => {
    it("shows one on an empty day, picks or not, so it can explain itself", () => {
      expect(shouldShowSuggestions(false, 0)).toBe(true);
    });

    it("leaves a day that already has plans alone", () => {
      // Ideas under planned days outnumbered the plans themselves.
      expect(shouldShowSuggestions(false, 1)).toBe(false);
      expect(shouldShowSuggestions(false, 3)).toBe(false);
    });
  });
});
