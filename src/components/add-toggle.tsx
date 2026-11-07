"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The round button at the end of a row in an add sheet: + to add, ✓ once
 * added, and tapping ✓ takes it back off. Adding no longer closes the sheet, so
 * this is how a row says what just happened to it.
 */
export function AddToggle({
  added,
  pending,
  onToggle,
  label,
  className,
}: {
  added: boolean;
  pending?: boolean;
  onToggle: () => void;
  /** What the row is, for the accessible name: "Creamy Lemon Pasta". */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={added}
      aria-label={added ? `Remove ${label}` : `Add ${label}`}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "disabled:opacity-60",
        added
          ? "bg-[var(--secondary-dark)] text-white"
          : "surface-raised text-[var(--primary)]",
        className
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : added ? (
        <Check className="size-4" strokeWidth={3} />
      ) : (
        <Plus className="size-4" strokeWidth={2.5} />
      )}
    </button>
  );
}
