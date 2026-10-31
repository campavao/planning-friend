"use client";

import { cn } from "@/lib/utils";

/**
 * An on/off preference. A switch rather than a "Turn Off" button, because the
 * button's label described the action instead of the state and read backwards
 * at a glance.
 */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        checked
          ? "bg-[var(--secondary-dark)]"
          : "surface-inset bg-[var(--border)]",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(45,52,54,0.3)] transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
