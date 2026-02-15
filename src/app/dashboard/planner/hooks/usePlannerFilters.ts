"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentCategory } from "@/lib/supabase";

const FILTER_STORAGE_KEY = "planner_item_filter";

function getStoredFilters(): {
  searchQuery: string;
  categoryFilter: ContentCategory | "all";
  selectedTagIds: string[];
} {
  if (typeof window === "undefined")
    return { searchQuery: "", categoryFilter: "all", selectedTagIds: [] };
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return stored
      ? JSON.parse(stored)
      : { searchQuery: "", categoryFilter: "all", selectedTagIds: [] };
  } catch {
    return { searchQuery: "", categoryFilter: "all", selectedTagIds: [] };
  }
}

function saveFilters(filters: {
  searchQuery: string;
  categoryFilter: ContentCategory | "all";
  selectedTagIds: string[];
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore
  }
}

export function usePlannerFilters() {
  const stored = useMemo(() => getStoredFilters(), []);
  const [searchQuery, setSearchQuery] = useState(stored.searchQuery);
  const [categoryFilter, setCategoryFilter] = useState<
    ContentCategory | "all"
  >(stored.categoryFilter);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    stored.selectedTagIds
  );

  useEffect(() => {
    saveFilters({ searchQuery, categoryFilter, selectedTagIds });
  }, [searchQuery, categoryFilter, selectedTagIds]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSelectedTagIds([]);
  }, []);

  const toggleTagSelection = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    selectedTagIds,
    setSelectedTagIds,
    clearAllFilters,
    toggleTagSelection,
  };
}
