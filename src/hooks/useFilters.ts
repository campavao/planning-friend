"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseFiltersOptions<T> {
  storageKey?: string;
  initial: T;
}

export function useFilters<T extends Record<string, unknown>>({
  storageKey,
  initial,
}: UseFiltersOptions<T>) {
  const stored = useMemo(() => {
    if (!storageKey || typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as Partial<T>;
      return { ...initial, ...parsed };
    } catch {
      return initial;
    }
  }, [storageKey, initial]);

  const [state, setState] = useState<T>(stored);

  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // ignore
      }
    }
  }, [storageKey, state]);

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setState(initial);
  }, [initial]);

  return { filters: state, setFilters: setState, update, reset };
}
