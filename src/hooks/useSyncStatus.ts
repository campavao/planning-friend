import { useEffect, useReducer, useSyncExternalStore } from "react";
import {
  getSyncServerSnapshot,
  getSyncSnapshot,
  subscribeSync,
} from "@/lib/swr-config";

function formatRelative(ts: number | null): string {
  if (!ts) return "";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * App-wide background-sync status. `syncing` is true whenever any SWR fetch is
 * in flight; `lastSyncedAt` is when the last one finished. `label` is a
 * ready-to-render caption ("Syncing…" / "Updated 5m ago"). Used to replace
 * per-page loading spinners with one quiet indicator at the top.
 */
export function useSyncStatus() {
  const { syncing, lastSyncedAt } = useSyncExternalStore(
    subscribeSync,
    getSyncSnapshot,
    getSyncServerSnapshot
  );

  // Re-render periodically so the relative "updated" label stays current.
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  const label = syncing
    ? "Syncing…"
    : lastSyncedAt
      ? `Updated ${formatRelative(lastSyncedAt)}`
      : "";

  return { syncing, lastSyncedAt, label };
}
