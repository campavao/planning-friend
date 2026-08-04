"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentCategory } from "@/lib/supabase";

const FILTER_STORAGE_KEY = "planner_item_filter";

// The add-modal's text field is deliberately not persisted: what you type
// there can become a quick note, and a phrase left over from last week
// shouldn't be sitting in the box waiting to be added as one.
interface PlannerFilters {
  categoryFilter: ContentCategory | "all";
  selectedTagIds: string[];
}

const DEFAULT_FILTERS: PlannerFilters = {
  categoryFilter: "all",
  selectedTagIds: [],
};

function getStoredFilters(): PlannerFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!stored) return DEFAULT_FILTERS;
    const parsed = JSON.parse(stored);
    return {
      categoryFilter: parsed?.categoryFilter ?? DEFAULT_FILTERS.categoryFilter,
      selectedTagIds: parsed?.selectedTagIds ?? DEFAULT_FILTERS.selectedTagIds,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(filters: PlannerFilters) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore
  }
}

export function usePlannerFilters() {
  const stored = useMemo(() => getStoredFilters(), []);
  const [categoryFilter, setCategoryFilter] = useState<
    ContentCategory | "all"
  >(stored.categoryFilter);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    stored.selectedTagIds
  );

  useEffect(() => {
    saveFilters({ categoryFilter, selectedTagIds });
  }, [categoryFilter, selectedTagIds]);

  const clearAllFilters = useCallback(() => {
    setCategoryFilter("all");
    setSelectedTagIds([]);
  }, []);

  const toggleTagSelection = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  return {
    categoryFilter,
    setCategoryFilter,
    selectedTagIds,
    setSelectedTagIds,
    clearAllFilters,
    toggleTagSelection,
  };
}
