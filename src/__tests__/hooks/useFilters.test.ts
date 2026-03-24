/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useFilters } from "@/hooks/useFilters";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
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
    localStorageMock.setItem(
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
    localStorageMock.setItem(
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
    const { result } = renderHook(() =>
      useFilters({ initial, storageKey: "test-filters" })
    );

    act(() => {
      result.current.update("search", "tacos");
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
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
    const { result } = renderHook(() => useFilters({ initial }));

    expect(result.current.filters).toEqual(initial);

    act(() => {
      result.current.update("category", "meal");
    });

    expect(result.current.filters.category).toBe("meal");
    // Should not try to read/write localStorage
    expect(localStorageMock.getItem).not.toHaveBeenCalled();
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorageMock.setItem("test-filters", "not-valid-json{{{");

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
