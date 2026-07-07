"use client";

import { useSyncStatus } from "@/hooks/useSyncStatus";

/**
 * A thin indeterminate progress line pinned to the very top of the viewport,
 * shown only while a background sync is in flight. Replaces per-page loading
 * spinners — content stays rendered as-is while this quietly signals fetching.
 */
export function TopProgressBar() {
  const { syncing } = useSyncStatus();

  return (
    <div
      aria-hidden
      className={`fixed inset-x-0 top-0 z-[60] h-0.5 pointer-events-none transition-opacity duration-300 ${
        syncing ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="sync-progress-line h-full w-full" />
    </div>
  );
}

/**
 * Small textual sync caption ("Syncing…" / "Updated 5m ago") for placing in a
 * page header. Renders nothing until there's something to say.
 */
export function SyncCaption({ className = "" }: { className?: string }) {
  const { syncing, label } = useSyncStatus();
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          syncing
            ? "bg-[var(--primary)] animate-pulse"
            : "bg-[var(--muted-foreground)]/40"
        }`}
      />
      {label}
    </span>
  );
}
