"use client";

import { ReactNode, useSyncExternalStore } from "react";
import type { Cache, State } from "swr";
import { SWRConfig } from "swr";

const CACHE_KEY = "planning-friend-cache";
const CACHE_VERSION = "v1";

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

// Create a localStorage-backed cache provider
// Returns a Cache-compatible object that persists to localStorage
function localStorageProvider(): Cache<SWRCacheState> {
  // Initialize from localStorage
  const map = new Map<string, SWRCacheState>();

  try {
    const stored = localStorage.getItem(`${CACHE_KEY}-${CACHE_VERSION}`);
    if (stored) {
      const entries = JSON.parse(stored) as [string, SWRCacheState][];
      entries.forEach(([key, value]) => {
        map.set(key, value);
      });
    }
  } catch {
    // Ignore parse errors
  }

  // Save to localStorage
  const saveCache = () => {
    try {
      const entries = Array.from(map.entries()).filter(([key, value]) => {
        // Only cache valid entries
        return key && value !== undefined;
      });
      localStorage.setItem(
        `${CACHE_KEY}-${CACHE_VERSION}`,
        JSON.stringify(entries)
      );
    } catch (e) {
      console.warn("Failed to save SWR cache to localStorage:", e);
    }
  };

  // Save before page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", saveCache);

    // Also save periodically to handle mobile app backgrounding
    setInterval(saveCache, 30000); // Every 30 seconds

    // Save when app is backgrounded (important for mobile PWA)
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        saveCache();
      }
    });
  }

  // Return a Cache-compatible object using type assertion
  // This is necessary because SWR's Cache interface has recursive generics
  // that don't play well with localStorage's serialization
  return map as unknown as Cache<SWRCacheState>;
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

export function SWRProvider({ children }: SWRProviderProps) {
  const isMounted = useIsMounted();

  // Don't use localStorage provider during SSR
  if (!isMounted) {
    return (
      <SWRConfig
        value={{
          fetcher,
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
        dedupingInterval: 2000,
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
    localStorage.removeItem(`${CACHE_KEY}-${CACHE_VERSION}`);
  } catch {
    // Ignore errors
  }
}
