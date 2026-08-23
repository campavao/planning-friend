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

/**
 * Sections used to be typed by the owner and validated only on PATCH. The
 * extraction fills them now — a booking's confirmation number has no field of
 * its own — so they are checked at this boundary too.
 */
describe("normalizeExtractedData — sections", () => {
  it("keeps the details read off a booking", () => {
    const data = {
      location: "1157 Chapel St, New Haven, CT",
      sections: [
        { label: "Confirmation", value: "8842-1173" },
        { label: "Check-in", value: "Sept 5, 4:00 PM" },
      ],
    };
    expect(normalizeExtractedData("travel", data)).toEqual(data);
  });

  it("trims, and drops an entry missing either half", () => {
    const out = normalizeExtractedData("travel", {
      sections: [
        { label: "  Room  ", value: "  King, 2 nights  " },
        { label: "Gate", value: "   " },
        { label: "", value: "orphaned" },
      ],
    });
    expect(out.sections).toEqual([{ label: "Room", value: "King, 2 nights" }]);
  });

  it("drops entries that are not label/value pairs at all", () => {
    const out = normalizeExtractedData("event", {
      sections: [
        "Confirmation: 8842",
        { label: "Door", value: 7 },
        ["Seat", "12A"],
        null,
        { label: "Seat", value: "12A" },
      ],
    });
    expect(out.sections).toEqual([{ label: "Seat", value: "12A" }]);
  });

  it("caps how many the model can add", () => {
    const out = normalizeExtractedData("travel", {
      sections: Array.from({ length: 9 }, (_, i) => ({
        label: `L${i}`,
        value: `V${i}`,
      })),
    });
    expect(out.sections).toHaveLength(4);
  });

  it("removes the key entirely when nothing survives", () => {
    for (const sections of [[], "Confirmation: 8842", [{ label: "x" }]]) {
      expect(normalizeExtractedData("travel", { sections })).not.toHaveProperty(
        "sections"
      );
    }
  });

  it("does not mutate the input", () => {
    const data = { sections: [{ label: "  Room  ", value: "King" }] };
    normalizeExtractedData("travel", data);
    expect(data.sections[0].label).toBe("  Room  ");
  });
});
