/**
 * @jest-environment jsdom
 */

/**
 * The strip has four things it can be showing, and telling them apart is the
 * difference between "the app is broken" and "there is nothing here right now":
 * loading, feature off, library too small, and ran-but-found-nothing.
 */

import { SuggestionStrip } from "@/app/dashboard/planner/components/SuggestionStrip";
import type { Content, Tag } from "@/lib/supabase";
import { fireEvent, render, screen } from "@testing-library/react";

const CONTENT: Content & { tags?: Tag[] } = {
  id: "c1",
  user_id: "user-1",
  tiktok_url: "https://example.com/c1",
  category: "meal",
  title: "Miso salmon",
  data: {},
  status: "completed",
  created_at: "2026-01-01T00:00:00.000Z",
  tags: [],
};

const contentById = new Map([[CONTENT.id, CONTENT]]);

function renderStrip(props: Partial<React.ComponentProps<typeof SuggestionStrip>> = {}) {
  const onRefresh = jest.fn();
  const view = render(
    <SuggestionStrip
      dayIndex={3}
      picks={[]}
      contentById={contentById}
      weekStart="2026-03-09"
      onAdd={jest.fn()}
      onDismiss={jest.fn()}
      onRefresh={onRefresh}
      {...props}
    />
  );
  return { ...view, onRefresh };
}

describe("SuggestionStrip states", () => {
  it("shows skeletons while the week is loading", () => {
    const { container } = renderStrip({ loading: true });
    expect(screen.getByText("Suggested")).toBeTruthy();
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Nothing left to suggest/)).toBeNull();
  });

  it("falls back to the plain empty-day copy when the feature is off", () => {
    renderStrip({ featureEnabled: false });
    expect(screen.getByText("No plans yet")).toBeTruthy();
    expect(screen.queryByText(/Nothing left to suggest/)).toBeNull();
    expect(screen.queryByText("Suggested")).toBeNull();
  });

  it("asks for more saved ideas when the library is too small", () => {
    renderStrip({ emptyPool: true });
    expect(
      screen.getByText("Save 3+ ideas to unlock smart suggestions.")
    ).toBeTruthy();
    expect(screen.queryByText(/Nothing left to suggest/)).toBeNull();
  });

  it("says the engine came up empty, and keeps refresh reachable", () => {
    const { onRefresh } = renderStrip({ picks: [] });

    expect(screen.getByText(/Nothing left to suggest for this day/)).toBeTruthy();
    expect(screen.queryByText("No plans yet")).toBeNull();

    fireEvent.click(screen.getByTitle("Refresh suggestions"));
    expect(onRefresh).toHaveBeenCalledWith(3);
  });

  it("treats a pick for content it cannot resolve as an empty day", () => {
    renderStrip({ picks: [{ contentId: "missing", why: null }] });
    expect(screen.getByText(/Nothing left to suggest for this day/)).toBeTruthy();
  });

  it("renders the picks it can resolve", () => {
    renderStrip({ picks: [{ contentId: "c1", why: "Thursday is usually fish" }] });
    expect(screen.getByText("Miso salmon")).toBeTruthy();
    expect(screen.getByText("Thursday is usually fish")).toBeTruthy();
    expect(screen.queryByText(/Nothing left to suggest/)).toBeNull();
  });
});
