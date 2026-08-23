/**
 * @jest-environment jsdom
 */

/**
 * The chip is a number the user is asked to trust, so the two things worth
 * pinning are that it never states more than it knows: a week holding meals
 * with no plant data has to say so, and a meal that repeats the week has to
 * read as adding nothing rather than as a contributor.
 */

import { WeekPlantScore } from "@/app/dashboard/planner/components/WeekPlantScore";
import { summarizeWeekPlants, type ScorableItem } from "@/lib/week-plants";
import { fireEvent, render, screen } from "@testing-library/react";

function meal(id: string, title: string, plants?: unknown): ScorableItem {
  return { content: { id, title, category: "meal", data: { plants } } };
}

const garlic = { source: "garlic", category: "vegetable" };
const onion = { source: "onion", category: "vegetable" };

function renderScore(items: ScorableItem[]) {
  return render(
    <WeekPlantScore
      summary={summarizeWeekPlants(items)}
      weekRangeLabel="Aug 17 - Aug 23"
    />,
  );
}

describe("WeekPlantScore", () => {
  it("shows the week's distinct plant count on the chip", () => {
    renderScore([meal("a", "Dal", [garlic, onion]), meal("b", "Stir fry", [garlic])]);

    expect(
      screen.getByRole("button", { name: /2 distinct plants/i }),
    ).toBeTruthy();
  });

  it("opens a breakdown naming the plants and the week", () => {
    renderScore([meal("a", "Dal", [garlic, onion])]);
    fireEvent.click(screen.getByRole("button"));

    expect(
      screen.getByRole("heading", { name: /2 distinct plants · Aug 17 - Aug 23/ }),
    ).toBeTruthy();
    expect(screen.getByText("garlic")).toBeTruthy();
    expect(screen.getByText("onion")).toBeTruthy();
  });

  it("marks a meal that repeats the week as adding nothing", () => {
    renderScore([meal("a", "Dal", [garlic, onion]), meal("b", "Soup", [onion])]);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("already covered")).toBeTruthy();
  });

  it("says the count is a floor when a meal has no plant data", () => {
    renderScore([meal("a", "Dal", [garlic]), meal("b", "TikTok link")]);
    fireEvent.click(screen.getByRole("button"));

    expect(
      screen.getByText(/1 meal this week has no plant data yet/i),
    ).toBeTruthy();
  });

  it("says nothing about missing data when every meal was scored", () => {
    renderScore([meal("a", "Dal", [garlic])]);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByText(/no plant data yet/i)).toBeNull();
  });
});
