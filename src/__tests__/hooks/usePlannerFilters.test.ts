/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { usePlannerFilters } from "@/app/dashboard/planner/hooks/usePlannerFilters";

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("usePlannerFilters", () => {
  it("initializes with default values", () => {
    const { result } = renderHook(() => usePlannerFilters());

    expect(result.current.searchQuery).toBe("");
    expect(result.current.categoryFilter).toBe("all");
    expect(result.current.selectedTagIds).toEqual([]);
  });

  it("loads stored filters from localStorage", () => {
    localStorage.setItem(
      "planner_item_filter",
      JSON.stringify({
        searchQuery: "pasta",
        categoryFilter: "meal",
        selectedTagIds: ["tag-1"],
      })
    );

    const { result } = renderHook(() => usePlannerFilters());

    expect(result.current.searchQuery).toBe("pasta");
    expect(result.current.categoryFilter).toBe("meal");
    expect(result.current.selectedTagIds).toEqual(["tag-1"]);
  });

  it("updates search query", () => {
    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.setSearchQuery("tacos");
    });

    expect(result.current.searchQuery).toBe("tacos");
  });

  it("updates category filter", () => {
    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.setCategoryFilter("drink");
    });

    expect(result.current.categoryFilter).toBe("drink");
  });

  it("toggles tag selection on", () => {
    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.toggleTagSelection("tag-1");
    });

    expect(result.current.selectedTagIds).toContain("tag-1");
  });

  it("toggles tag selection off", () => {
    localStorage.setItem(
      "planner_item_filter",
      JSON.stringify({
        searchQuery: "",
        categoryFilter: "all",
        selectedTagIds: ["tag-1", "tag-2"],
      })
    );

    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.toggleTagSelection("tag-1");
    });

    expect(result.current.selectedTagIds).not.toContain("tag-1");
    expect(result.current.selectedTagIds).toContain("tag-2");
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.setSearchQuery("pizza");
      result.current.setCategoryFilter("meal");
      result.current.toggleTagSelection("tag-1");
    });

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.categoryFilter).toBe("all");
    expect(result.current.selectedTagIds).toEqual([]);
  });

  it("persists filters to localStorage on change", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.setSearchQuery("sushi");
    });

    expect(spy).toHaveBeenCalledWith(
      "planner_item_filter",
      expect.stringContaining("sushi")
    );
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("planner_item_filter", "invalid-json!!!");

    const { result } = renderHook(() => usePlannerFilters());

    expect(result.current.searchQuery).toBe("");
    expect(result.current.categoryFilter).toBe("all");
    expect(result.current.selectedTagIds).toEqual([]);
  });

  it("sets selected tag IDs directly", () => {
    const { result } = renderHook(() => usePlannerFilters());

    act(() => {
      result.current.setSelectedTagIds(["tag-a", "tag-b", "tag-c"]);
    });

    expect(result.current.selectedTagIds).toEqual(["tag-a", "tag-b", "tag-c"]);
  });
});
