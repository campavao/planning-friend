/**
 * Per-category item attributes (PLA-59).
 *
 * Two things these pin down. First, that every category actually produces
 * something — the hole this ticket exists to close is that only recipes did.
 * Second, that shared concepts share a key: `key` is the future filter
 * dimension, so a gift's cost and a restaurant's price range keying differently
 * would silently turn one filter into two.
 */

import {
  describeAttributes,
  travelDestination,
  type AttributeKey,
} from "@/lib/attributes";

function keys(attrs: { key: AttributeKey }[]): AttributeKey[] {
  return attrs.map((a) => a.key);
}

function labelFor(
  attrs: { key: AttributeKey; label: string }[],
  key: AttributeKey
): string | undefined {
  return attrs.find((a) => a.key === key)?.label;
}

describe("describeAttributes", () => {
  it("gives a recipe its effort, spice and plant count", () => {
    const attrs = describeAttributes("meal", {
      effort: "hard",
      spice: "mild",
      plants: [
        { source: "garlic", category: "vegetable" },
        { source: "lentil", category: "legume" },
      ],
    });

    expect(labelFor(attrs, "effort")).toBe("Involved");
    expect(labelFor(attrs, "spice")).toBe("Mild");
    expect(labelFor(attrs, "plants")).toBe("2 plants");
  });

  it("counts plants by the same rules as everywhere else", () => {
    // Seasonings are excluded and duplicate sources collapse — this must not
    // become a second, looser implementation of the plant count.
    const attrs = describeAttributes("meal", {
      plants: [
        { source: "garlic", category: "vegetable" },
        { source: "garlic", category: "vegetable" },
        { source: "cumin", category: "seed" },
      ],
    });

    expect(labelFor(attrs, "plants")).toBe("1 plant");
  });

  describe("every category produces something", () => {
    it("drink", () => {
      const attrs = describeAttributes("drink", {
        type: "cocktail",
        difficulty: "easy",
        prep_time: "5 min",
      });
      expect(labelFor(attrs, "type")).toBe("Cocktail");
      // A drink's difficulty is the same three-value scale as a recipe's
      // effort, so it keys as effort rather than inventing a parallel axis.
      expect(labelFor(attrs, "effort")).toBe("Easy");
      expect(labelFor(attrs, "prep")).toBe("5 min");
    });

    it("event", () => {
      const attrs = describeAttributes("event", {
        requires_ticket: true,
        requires_reservation: true,
      });
      expect(keys(attrs)).toEqual(["ticket", "reservation"]);
    });

    it("date_idea", () => {
      const attrs = describeAttributes("date_idea", {
        type: "dinner",
        price_range: "$$",
      });
      expect(labelFor(attrs, "type")).toBe("Dinner");
      expect(labelFor(attrs, "price")).toBe("$$");
    });

    it("travel", () => {
      const attrs = describeAttributes("travel", {
        type: "attraction",
        price_range: "$$$",
        destination_city: "Paris",
        destination_country: "France",
      });
      expect(labelFor(attrs, "type")).toBe("Attraction");
      // There is a Paris in Texas; the country rides along when both are known.
      expect(labelFor(attrs, "destination")).toBe("Paris, France");
    });

    it("gift_idea", () => {
      const attrs = describeAttributes("gift_idea", { cost: "$29.99" });
      expect(labelFor(attrs, "price")).toBe("$29.99");
    });
  });

  it("keys a gift's cost and a restaurant's price the same way", () => {
    const gift = describeAttributes("gift_idea", { cost: "$40" });
    const dinner = describeAttributes("date_idea", { price_range: "$$" });

    // "Show me the cheap ones" is one question, not two.
    expect(keys(gift)).toContain("price");
    expect(keys(dinner)).toContain("price");
  });

  it("renders nothing rather than Unknown for absent fields", () => {
    // An item saved before a field existed must show no chip at all, not a
    // row of confident-looking blanks.
    expect(describeAttributes("meal", {})).toEqual([]);
    expect(describeAttributes("travel", {})).toEqual([]);
    expect(describeAttributes("event", {})).toEqual([]);
  });

  it("omits event flags that are explicitly false", () => {
    const attrs = describeAttributes("event", {
      requires_ticket: false,
      requires_reservation: false,
    });

    // "No ticket required" is not worth a chip; the absence says it.
    expect(attrs).toEqual([]);
  });

  it("survives null data and unknown categories", () => {
    expect(describeAttributes("meal", null)).toEqual([]);
    expect(describeAttributes("other", { anything: true })).toEqual([]);
  });
});

describe("travelDestination", () => {
  it("prefers the city, and keeps the country alongside it", () => {
    expect(
      travelDestination({
        destination_city: "Minneapolis",
        destination_country: "USA",
        location: "Paisley Park",
      }),
    ).toBe("Minneapolis, USA");
  });

  it("falls back to location only when there is no destination", () => {
    // `location` on a travel item is frequently a venue rather than a place,
    // and a venue in a planner day header answers a question nobody asked —
    // so it is the last resort, not the first choice.
    expect(travelDestination({ location: "Paisley Park" })).toBe(
      "Paisley Park",
    );
  });

  it("is null when the item says nothing about where it is", () => {
    expect(travelDestination({})).toBeNull();
    expect(travelDestination(null)).toBeNull();
  });
});
