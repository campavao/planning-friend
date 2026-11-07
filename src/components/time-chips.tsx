"use client";

import { useRef } from "react";
import { formatTimeLabel, TIME_PRESETS } from "@/lib/plan-time";
import { cn } from "@/lib/utils";

const SEGMENT =
  "relative flex flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all active:translate-y-px focus-within:ring-2 focus-within:ring-[var(--ring)]";

/**
 * When it happens, as one tap: Breakfast, Lunch, Dinner, or a time of your
 * own. Most plans are one of the three, and a bare time field made every one
 * of them a trip through a picker. Four equal segments rather than a scrolling
 * row, so the custom option is never off the edge.
 */
export function TimeChips({
  value,
  onChange,
}: {
  /** "HH:MM", 24-hour. */
  value: string;
  onChange: (time: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreset = TIME_PRESETS.some((preset) => preset.value === value);

  return (
    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Time">
      {TIME_PRESETS.map((preset) => {
        const selected = preset.value === value;
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            aria-pressed={selected}
            className={cn(
              SEGMENT,
              selected ? "bg-foreground text-background" : "surface-raised"
            )}
          >
            <span className="text-[13px] font-semibold leading-tight">
              {preset.label}
            </span>
            <span
              className={cn(
                "text-[11px] leading-tight",
                selected ? "opacity-70" : "text-muted-foreground"
              )}
            >
              {formatTimeLabel(preset.value).replace(":00", "")}
            </span>
          </button>
        );
      })}
      {/* The native time input itself covers the segment, so a tap opens the
          phone's own wheel; showPicker does the same for a mouse. */}
      <label
        className={cn(
          SEGMENT,
          "cursor-pointer",
          !isPreset ? "bg-foreground text-background" : "surface-raised"
        )}
      >
        <span className="text-[13px] font-semibold leading-tight">Other</span>
        <span
          className={cn(
            "text-[11px] leading-tight",
            !isPreset ? "opacity-70" : "text-muted-foreground"
          )}
        >
          {isPreset ? "Pick time" : formatTimeLabel(value)}
        </span>
        <input
          ref={inputRef}
          type="time"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={() => {
            try {
              inputRef.current?.showPicker?.();
            } catch {
              // Not every browser lets a click open it; focus is enough.
            }
          }}
          aria-label="Pick a time"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
