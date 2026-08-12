/**
 * @jest-environment jsdom
 */
import { ItemNotes } from "@/app/dashboard/[id]/components/ItemNotes";
import type { ItemNoteWithOccasion } from "@/lib/db/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const CONTENT_ID = "content-1";

const NOTES: ItemNoteWithOccasion[] = [
  {
    id: "note-2",
    content_id: CONTENT_ID,
    user_id: "user-1",
    body: "Better the second time — less salt.",
    rating: 4,
    plan_item_id: "item-9",
    created_at: "2026-03-11T21:30:00.000Z",
    occasion: {
      id: "item-9",
      planned_date: "2026-03-10T19:00:00.000Z",
      note_title: "Tuesday dinner",
    },
  },
  {
    id: "note-1",
    content_id: CONTENT_ID,
    user_id: "user-1",
    body: "Way too salty.",
    rating: 2,
    plan_item_id: null,
    created_at: "2026-01-04T20:00:00.000Z",
    occasion: null,
  },
];

const fetchMock = jest.fn();

function renderNotes(props: { autoOpenComposer?: boolean } = {}) {
  return render(
    // A fresh cache per test — SWR's default provider is shared across renders.
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ItemNotes contentId={CONTENT_ID} {...props} />
    </SWRConfig>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, notes: NOTES }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("ItemNotes", () => {
  it("lists the notes it was given, newest first", async () => {
    renderNotes();

    await screen.findByText("Better the second time — less salt.");
    const bodies = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");

    expect(bodies[0]).toContain("Better the second time");
    expect(bodies[1]).toContain("Way too salty");
  });

  it("stamps a note with the occasion it came from", async () => {
    renderNotes();

    const items = await screen.findAllByRole("listitem");
    expect(items[0].textContent).toContain("Tuesday dinner");
    // A note written outside any plan item carries no occasion label.
    expect(items[1].textContent).not.toContain("Tuesday dinner");
  });

  it("keeps the composer closed until it is asked for", async () => {
    renderNotes();

    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("opens the composer straight away for the reminder deep link", async () => {
    // The push links to /dashboard/<id>?note=new precisely so the nudge can be
    // acted on in one tap; a composer that still needs a tap defeats it.
    renderNotes({ autoOpenComposer: true });

    expect(screen.getByRole("textbox")).toBeTruthy();
    await screen.findAllByRole("listitem");
  });

  it("posts the body and rating to the item's notes endpoint", async () => {
    renderNotes({ autoOpenComposer: true });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Great, would repeat.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "POST"
      );
      expect(post).toBeTruthy();
      expect(post![0]).toBe(`/api/content/${CONTENT_ID}/notes`);
      expect(JSON.parse(post![1].body)).toEqual({
        body: "Great, would repeat.",
        rating: 5,
      });
    });
  });

  it("sends no rating when the writer did not give one", async () => {
    renderNotes({ autoOpenComposer: true });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "No strong feelings." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "POST"
      );
      expect(JSON.parse(post![1].body).rating).toBeNull();
    });
  });

  it("will not save an empty note", async () => {
    renderNotes({ autoOpenComposer: true });

    const save = screen.getByRole("button", { name: "Save note" });
    expect(save.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "   " },
    });
    expect(save.hasAttribute("disabled")).toBe(true);
  });
});
