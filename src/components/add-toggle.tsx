"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The round button at the end of a row in an add sheet: + to add, ✓ once
 * added, and tapping ✓ takes it back off. Adding no longer closes the sheet, so
 * this is how a row says what just happened to it.
 *
 * Turning into a check pops and draws the check — only on the change, not
 * when a row that was already added first appears.
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
  // Counts the times this row has turned into a check. Derived while
  // rendering (React's pattern for reacting to a prop change), and used as a
  // key so each new check mounts fresh and plays its pop once.
  const [prevAdded, setPrevAdded] = useState(added);
  const [pops, setPops] = useState(0);
  if (added !== prevAdded) {
    setPrevAdded(added);
    if (added) setPops((n) => n + 1);
  }
  const popping = added && pops > 0;

  return (
    <button
      type="button"
      onClick={() => {
        // A tick under the thumb where the phone supports it (not iOS Safari).
        if (!added) navigator.vibrate?.(8);
        onToggle();
      }}
      disabled={pending}
      aria-pressed={added}
      aria-label={added ? `Remove ${label}` : `Add ${label}`}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200 active:scale-90",
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
        <span
          key={pops}
          className={cn("inline-flex", popping && "toggle-pop")}
        >
          <Check
            className={cn("size-4", popping && "check-draw")}
            strokeWidth={3}
          />
        </span>
      ) : (
        <Plus className="size-4" strokeWidth={2.5} />
      )}
    </button>
  );
}
