/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useFilters } from "@/hooks/useFilters";

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("useFilters", () => {
  const initial = { category: "all", search: "" };

  it("returns initial state when no localStorage data exists", () => {
    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    expect(result.current.filters).toEqual(initial);
  });

  it("loads stored filters from localStorage", () => {
    localStorage.setItem(
      "test-filters",
      JSON.stringify({ category: "meal", search: "pasta" })
    );

    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    expect(result.current.filters.category).toBe("meal");
    expect(result.current.filters.search).toBe("pasta");
  });

  it("merges stored filters with initial (fills missing keys)", () => {
    localStorage.setItem(
      "test-filters",
      JSON.stringify({ category: "drink" })
    );

    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    expect(result.current.filters.category).toBe("drink");
    expect(result.current.filters.search).toBe(""); // from initial
  });

  it("updates a single filter key", () => {
    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    act(() => {
      result.current.update("category", "event");
    });

    expect(result.current.filters.category).toBe("event");
    expect(result.current.filters.search).toBe(""); // unchanged
  });

  it("persists to localStorage on update", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    act(() => {
      result.current.update("search", "tacos");
    });

    expect(spy).toHaveBeenCalledWith(
      "test-filters",
      expect.stringContaining("tacos")
    );
  });

  it("resets to initial state", () => {
    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    act(() => {
      result.current.update("category", "travel");
      result.current.update("search", "paris");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.filters).toEqual(initial);
  });

  it("works without a storageKey (no persistence)", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem");

    const { result } = renderHook(() => useFilters({ initial }));

    expect(result.current.filters).toEqual(initial);

    act(() => {
      result.current.update("category", "meal");
    });

    expect(result.current.filters.category).toBe("meal");
    expect(spy).not.toHaveBeenCalled();
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("test-filters", "not-valid-json{{{");

    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    // Should fall back to initial
    expect(result.current.filters).toEqual(initial);
  });

  it("setFilters replaces entire state", () => {
    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    act(() => {
      result.current.setFilters({ category: "gift_idea", search: "watch" });
    });

    expect(result.current.filters).toEqual({
      category: "gift_idea",
      search: "watch",
    });
  });
});
