import { useEffect, useRef } from "react";
import { preload } from "swr";
import { fetcher } from "@/lib/swr-config";
import { getWeekStartDay, getWeekStartForDate } from "@/lib/utils";

// The SWR keys each bottom-nav tab fetches on mount. Warming them once the
// dashboard shell is up means tapping a tab reads a hot cache instead of
// blanking to a full-screen spinner.
function tabKeys(): string[] {
  const week = getWeekStartForDate(new Date(), getWeekStartDay());
  return [
    "/api/content?includeTags=true", // Home
    "/api/tags",
    "/api/friends", // Friends
    "/api/gifts/recipients?include=assignments", // Gifts
    "/api/gifts/assignments", // Gifts
    "/api/settings", // Settings
    "/api/users/name", // Settings
    `/api/planner?week=${week}`, // Plan
  ];
}

/**
 * Prefetch the other tabs' data once, shortly after the dashboard shell
 * mounts. Runs a beat after mount so it doesn't compete with the current
 * page's own initial fetch, and only when on a dashboard route (the endpoints
 * 401 without a session). preload() dedupes against anything already loading.
 */
export function useTabPrefetch(active: boolean) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !active) return;
    done.current = true;

    const schedule =
      typeof window !== "undefined" &&
      "requestIdleCallback" in window
        ? (cb: () => void) =>
            (window as unknown as {
              requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
            }).requestIdleCallback(cb, { timeout: 2000 })
        : (cb: () => void) => window.setTimeout(cb, 1000);

    schedule(() => {
      for (const key of tabKeys()) {
        preload(key, fetcher);
      }
    });
  }, [active]);
}
