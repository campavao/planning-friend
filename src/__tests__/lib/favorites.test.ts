/**
 * Tests for the starring helpers in lib/favorites.ts
 */

import {
  filterByFavorites,
  isFavorite,
  saveFavorite,
  setFavorite,
} from "@/lib/favorites";
import type { ContentWithTags } from "@/lib/db/types";

// Rows fetched before schema-favorites.sql is applied have no is_favorite at
// all, so the fixtures deliberately mix present, absent and false.
const items = [
  { id: "1", title: "Starred", is_favorite: true },
  { id: "2", title: "Explicitly unstarred", is_favorite: false },
  { id: "3", title: "Pre-migration row" },
] as unknown as ContentWithTags[];

describe("isFavorite", () => {
  it("is true only for an explicit true", () => {
    expect(isFavorite(items[0])).toBe(true);
    expect(isFavorite(items[1])).toBe(false);
    expect(isFavorite(items[2])).toBe(false);
  });

  it("treats a missing item as unstarred", () => {
    expect(isFavorite(null)).toBe(false);
    expect(isFavorite(undefined)).toBe(false);
  });
});

describe("filterByFavorites", () => {
  it("passes everything through when the filter is off", () => {
    expect(filterByFavorites(items, false)).toEqual(items);
  });

  it("keeps only starred items when the filter is on", () => {
    expect(filterByFavorites(items, true).map((i) => i.id)).toEqual(["1"]);
  });

  it("returns empty when nothing is starred", () => {
    expect(filterByFavorites([items[2]], true)).toHaveLength(0);
  });
});

describe("setFavorite", () => {
  it("flips the targeted row only", () => {
    const next = setFavorite(items, "3", true);
    expect(next.map((i) => i.is_favorite)).toEqual([true, false, true]);
  });

  it("can unstar", () => {
    expect(setFavorite(items, "1", false)[0].is_favorite).toBe(false);
  });

  it("does not mutate the original list or its rows", () => {
    const next = setFavorite(items, "1", false);
    expect(items[0].is_favorite).toBe(true);
    expect(next[0]).not.toBe(items[0]);
    expect(next[1]).toBe(items[1]);
  });

  it("is a no-op when the id is not in the list", () => {
    expect(setFavorite(items, "missing", true)).toEqual(items);
  });
});

describe("saveFavorite", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("PATCHes the item with the flag and nothing else", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await saveFavorite("abc", true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/content/abc");
    expect(init.method).toBe("PATCH");
    // Guards the rule that starring is never an edit: no title, no data.
    expect(JSON.parse(init.body)).toEqual({ is_favorite: true });
  });

  it("reports success and failure so callers can roll back", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(saveFavorite("abc", false)).resolves.toBe(true);

    fetchMock.mockResolvedValue({ ok: false });
    await expect(saveFavorite("abc", true)).resolves.toBe(false);
  });

  it("reports failure when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(saveFavorite("abc", true)).resolves.toBe(false);
  });
});
