"use client";

import { ReactNode, useEffect, useLayoutEffect } from "react";
import type { Cache, State } from "swr";
import { SWRConfig, useSWRConfig } from "swr";

const CACHE_KEY = "planning-friend-cache";
// v2: entries are persisted as { data } only (no error/loading flags) and
// auth keys are never persisted. Bumping the version discards old caches
// that contain stale auth state or transient flags.
const CACHE_VERSION = "v2";
const STORAGE_KEY = `${CACHE_KEY}-${CACHE_VERSION}`;
const LEGACY_STORAGE_KEYS = [`${CACHE_KEY}-v1`];

// SWR's internal state type for cache entries
type SWRCacheState = State<unknown, unknown>;

// Custom fetcher with error handling
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }

  return res.json();
}

// Auth/session state must never be served from persistent storage: a stale
// "unauthenticated" entry bounces logged-in users back to the login page,
// and a stale "authenticated" entry does the reverse.
function isPersistableKey(key: string): boolean {
  return !key.includes("/api/auth/");
}

// Single cache map for the lifetime of the page. SWR's initial revalidation
// runs exactly once per hook (a layout effect keyed on the request key), so
// the cache instance must NEVER be swapped after mount — a swap strands
// in-flight requests in the old cache and the hooks never refetch, leaving
// pages stuck loading or flashing between caches.
const cacheMap = new Map<string, SWRCacheState>();

function localStorageProvider(): Cache<SWRCacheState> {
  // Type assertion needed due to SWR's complex recursive Cache generics
  return cacheMap as unknown as Cache<SWRCacheState>;
}

function readPersistedEntries(): [string, unknown][] {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const entries = JSON.parse(stored) as [string, SWRCacheState][];
    return entries
      .filter(
        ([key, value]) =>
          key && isPersistableKey(key) && value?.data !== undefined
      )
      // Restore data only — never transient flags or errors, otherwise a
      // hook can wake up permanently "loading" or showing a stale error.
      .map(([key, value]) => [key, value.data]);
  } catch {
    return [];
  }
}

function saveCache() {
  try {
    const entries = Array.from(cacheMap.entries())
      .filter(([key, value]) => {
        return key && isPersistableKey(key) && value?.data !== undefined;
      })
      .map(([key, value]) => [key, { data: value.data }]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn("Failed to save SWR cache to localStorage:", e);
  }
}

// Module-level so StrictMode double-mounts can't hydrate twice or stack up
// persistence listeners/intervals.
let hydrationDone = false;

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// Rendered as the FIRST child of SWRConfig so its layout effect runs before
// any data hook starts its initial request. It injects the persisted cache
// through mutate() — after hydration, so the first render matches the server
// HTML — and every mounted hook still revalidates in the background
// (classic stale-while-revalidate).
function CacheHydrator() {
  const { mutate } = useSWRConfig();

  useIsomorphicLayoutEffect(() => {
    if (hydrationDone || typeof window === "undefined") return;
    hydrationDone = true;

    for (const [key, data] of readPersistedEntries()) {
      mutate(key, data, { revalidate: false });
    }

    window.addEventListener("beforeunload", saveCache);
    setInterval(saveCache, 30000);
    // Save when app is backgrounded (important for mobile PWA)
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        saveCache();
      }
    });
  }, [mutate]);

  return null;
}

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        provider: localStorageProvider as unknown as () => Cache<SWRCacheState>,
        fetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        // Keep previous data while revalidating for smoother UX
        keepPreviousData: true,
        // Error retry configuration
        errorRetryCount: 3,
        errorRetryInterval: 5000,
      }}
    >
      <CacheHydrator />
      {children}
    </SWRConfig>
  );
}

// Helper to clear the cache (useful for logout)
export function clearSWRCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore errors
  }
  // Also clear the in-memory cache so the next account on this device
  // doesn't briefly see the previous account's data.
  cacheMap.clear();
}
