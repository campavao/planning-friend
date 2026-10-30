/**
 * @jest-environment jsdom
 */

/**
 * Planner cards expand in place. What's worth pinning is the interaction, not
 * the layout: a tap opens the details and a second closes them, the card's own
 * buttons still do their own job rather than toggling it, and a quick note with
 * nothing more to say doesn't pretend it can expand.
 */

import { WeekSection } from "@/app/dashboard/planner/components/WeekSection";
import type { PlanItemWithSharing } from "@/hooks/usePlanner";
import { fireEvent, render, screen, within } from "@testing-library/react";

const items: PlanItemWithSharing[] = [
  {
    id: "meal-1",
    plan_id: "plan",
    is_owner: true,
    content_id: "c-meal",
    planned_date: "2026-08-17T00:00:00Z",
    slot_order: 0,
    created_at: "2026-08-01T00:00:00Z",
    notes: "Double the garlic",
    content: {
      id: "c-meal",
      user_id: "u",
      tiktok_url: "",
      category: "meal",
      title: "Lemon pasta",
      data: { prep_time: "10 min", ingredients: ["pasta", "lemon"] },
      status: "completed",
      created_at: "2026-08-01T00:00:00Z",
    },
  },
  {
    id: "note-1",
    plan_id: "plan",
    is_owner: true,
    planned_date: "2026-08-17T00:00:00Z",
    slot_order: 1,
    created_at: "2026-08-01T00:00:00Z",
    note_title: "Call mom",
    notes: "Ask about the weekend",
  },
  {
    id: "note-2",
    plan_id: "plan",
    is_owner: true,
    planned_date: "2026-08-17T00:00:00Z",
    slot_order: 2,
    created_at: "2026-08-01T00:00:00Z",
    note_title: "Water plants",
  },
];

jest.mock("@/hooks/usePlanner", () => ({
  usePlanner: () => ({
    data: {
      plan: { id: "plan", user_id: "u", week_start: "2026-08-17", created_at: "", items },
      sharedItems: [],
      suggestions: {},
      suggestionsMeta: { enabled: false, emptyPool: false, poolSize: 0 },
    },
  }),
}));

const onOpenEdit = jest.fn();

function renderWeek() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return render(
    <WeekSection
      weekStart="2026-08-17"
      enabled
      days={days}
      daysFull={days}
      contentById={new Map()}
      highlightDate={null}
      dismissedSuggestions={new Set()}
      suggestionsHidden
      refreshingKey={null}
      registerDayElement={() => {}}
      onOpenAdd={() => {}}
      onOpenEdit={onOpenEdit}
      onOpenShare={() => {}}
      onLeaveShared={() => {}}
      onShareAutoEvent={() => {}}
      onAddSuggestion={() => {}}
      onDismissSuggestion={() => {}}
      onRefreshSuggestions={() => {}}
    />,
  );
}

// Mobile and desktop trees both render under jsdom (CSS hides one); the
// mobile tree comes first, so the first match is the mobile card.
function firstToggle(name: RegExp) {
  return screen.getAllByRole("button", { name })[0];
}

describe("WeekSection expandable cards", () => {
  it("opens a content card's details on tap and closes them on a second", () => {
    renderWeek();
    const toggle = firstToggle(/expand lemon pasta/i);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Double the garlic")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText("Double the garlic").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prep 10 min").length).toBeGreaterThan(0);
    const open = screen.getAllByRole("link", { name: /open/i })[0];
    expect(open.getAttribute("href")).toBe(
      "/dashboard/c-meal?from=planner&week=2026-08-17",
    );

    fireEvent.click(firstToggle(/collapse lemon pasta/i));
    expect(screen.queryByText("Double the garlic")).toBeNull();
  });

  it("expands a quick note into its body", () => {
    renderWeek();
    fireEvent.click(firstToggle(/expand call mom/i));

    expect(screen.getAllByText("Ask about the weekend").length).toBeGreaterThan(0);
  });

  it("leaves a quick note with no body unexpandable", () => {
    renderWeek();

    expect(screen.queryByRole("button", { name: /expand water plants/i })).toBeNull();
  });

  it("keeps the card's own buttons working without toggling it", () => {
    renderWeek();
    const toggle = firstToggle(/expand lemon pasta/i);
    const card = toggle.parentElement!;

    fireEvent.click(within(card).getByTitle("Edit"));

    expect(onOpenEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "meal-1" }),
      "2026-08-17",
    );
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
