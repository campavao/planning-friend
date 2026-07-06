"use client";

import { ReactNode, useSyncExternalStore } from "react";
import type { Cache, State } from "swr";
import { SWRConfig } from "swr";

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

// Single cache map shared for the lifetime of the page. Keeping it at module
// level guarantees the SWR cache is never swapped mid-session (a swap forces
// every mounted hook to drop its data and refetch, which flashes the UI).
let cacheMap: Map<string, SWRCacheState> | null = null;

function loadPersistedEntries(map: Map<string, SWRCacheState>) {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const entries = JSON.parse(stored) as [string, SWRCacheState][];
      entries.forEach(([key, value]) => {
        if (!key || !isPersistableKey(key) || value?.data === undefined) {
          return;
        }
        // Restore data only — never transient flags or errors, otherwise a
        // hook can wake up permanently "loading" or showing a stale error.
        map.set(key, { data: value.data });
      });
    }
  } catch {
    // Ignore parse errors
  }
}

function saveCache() {
  if (!cacheMap) return;
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

function getCacheMap(): Map<string, SWRCacheState> {
  if (cacheMap) return cacheMap;

  cacheMap = new Map<string, SWRCacheState>();

  if (typeof window !== "undefined") {
    loadPersistedEntries(cacheMap);

    // Registered once per page load (module scope), so re-renders and
    // StrictMode double-mounts can't stack up intervals or listeners.
    window.addEventListener("beforeunload", saveCache);
    setInterval(saveCache, 30000);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        saveCache();
      }
    });
  }

  return cacheMap;
}

function localStorageProvider(): Cache<SWRCacheState> {
  // Return a Cache-compatible object using type assertion
  // This is necessary because SWR's Cache interface has recursive generics
  // that don't play well with localStorage's serialization
  return getCacheMap() as unknown as Cache<SWRCacheState>;
}

interface SWRProviderProps {
  children: ReactNode;
}

// Use useSyncExternalStore for hydration-safe mounting detection
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {}, // subscribe (no-op)
    () => true, // getSnapshot (client)
    () => false // getServerSnapshot (server)
  );
}

const alwaysPaused = () => true;

export function SWRProvider({ children }: SWRProviderProps) {
  const isMounted = useIsMounted();

  // During SSR and the hydration render, pause all revalidation so no fetch
  // starts against the default (throwaway) cache — those results would be
  // discarded when the persistent cache attaches, causing a refetch flash.
  if (!isMounted) {
    return (
      <SWRConfig
        value={{
          fetcher,
          isPaused: alwaysPaused,
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          dedupingInterval: 2000,
        }}
      >
        {children}
      </SWRConfig>
    );
  }

  return (
    <SWRConfig
      value={{
        // Type assertion needed due to SWR's complex recursive Cache generics
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
  cacheMap?.clear();
}
