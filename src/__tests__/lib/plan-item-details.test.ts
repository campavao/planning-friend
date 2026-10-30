/**
 * What an expanded planner card shows. The two things worth pinning: that each
 * category surfaces the fields that answer "what do I need for this?", and that
 * an item missing those fields renders nothing rather than empty rows.
 */

import { planItemDetails } from "@/lib/plan-item-details";
import type { Content, PlanItem } from "@/lib/supabase";

function planned(
  category: Content["category"],
  data: Record<string, unknown>,
  extra: Partial<PlanItem> = {},
): PlanItem {
  return {
    id: "p1",
    plan_id: "plan",
    content_id: "c1",
    planned_date: "2026-08-23T00:00:00Z",
    slot_order: 0,
    created_at: "2026-08-01T00:00:00Z",
    content: {
      id: "c1",
      user_id: "u",
      tiktok_url: "",
      category,
      title: "Thing",
      data: data as Content["data"],
      status: "completed",
      created_at: "2026-08-01T00:00:00Z",
    },
    ...extra,
  };
}

describe("planItemDetails", () => {
  it("gives a recipe its timings and a capped ingredient list", () => {
    const details = planItemDetails(
      planned("meal", {
        prep_time: "10 min",
        cook_time: "20 min",
        servings: "4",
        ingredients: ["a", "b", "c", "d", "e", "f", "g", "h"],
      }),
    );

    expect(details.timings).toEqual(["Prep 10 min", "Cook 20 min", "Serves 4"]);
    expect(details.ingredients).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(details.moreIngredients).toBe(2);
  });

  it("gives an event its date, time and location", () => {
    const details = planItemDetails(
      planned("event", {
        date: "Sat, Aug 23",
        time: "7pm",
        location: "The Fillmore",
        description: "Live set",
      }),
    );

    expect(details.when).toBe("Sat, Aug 23 · 7pm");
    expect(details.location).toBe("The Fillmore");
    expect(details.description).toBe("Live set");
  });

  it("reads a stay as a range", () => {
    const details = planItemDetails(
      planned("travel", { date: "Aug 23", end_date: "Aug 27" }),
    );

    expect(details.when).toBe("Aug 23 → Aug 27");
  });

  it("does not repeat a drink's prep time as a chip", () => {
    const details = planItemDetails(
      planned("drink", { prep_time: "5 min", type: "cocktail" }),
    );

    expect(details.timings).toEqual(["Prep 5 min"]);
    expect(details.attributes.map((a) => a.key)).toEqual(["type"]);
  });

  it("carries the planning note, and only the note for a quick note", () => {
    const quickNote: PlanItem = {
      id: "n1",
      plan_id: "plan",
      planned_date: "2026-08-23T00:00:00Z",
      slot_order: 0,
      created_at: "2026-08-01T00:00:00Z",
      note_title: "Call mom",
      notes: "  ask about the weekend  ",
    };

    expect(planItemDetails(quickNote)).toEqual({
      attributes: [],
      timings: [],
      ingredients: [],
      moreIngredients: 0,
      note: "ask about the weekend",
    });
  });

  it("renders nothing for fields an item doesn't have", () => {
    const details = planItemDetails(
      planned("event", { date: "  ", ingredients: ["not for events"] }),
    );

    expect(details.when).toBeUndefined();
    expect(details.location).toBeUndefined();
    expect(details.ingredients).toEqual([]);
    expect(details.note).toBeUndefined();
  });
});
