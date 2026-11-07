"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftWeeks, weekDays } from "@/lib/plan-time";
import { cn, formatDateString, parseDateString } from "@/lib/utils";

/**
 * Pick a day from a week of date circles, with arrows for the weeks either
 * side. Replaces a fourteen-row list of days: the whole week is one glance, and
 * moving an item to Thursday is a tap on Thursday instead of a scroll.
 */
export function WeekStrip({
  value,
  onChange,
  weekStartDay,
  minDate,
}: {
  /** The selected day, YYYY-MM-DD. */
  value: string;
  onChange: (dateKey: string) => void;
  weekStartDay: number;
  /** Days before this (YYYY-MM-DD) can't be picked. */
  minDate?: string;
}) {
  const days = weekDays(value, weekStartDay);
  const todayKey = formatDateString(new Date());
  const canGoBack = !minDate || days[0] > minDate;

  const monthLabel = (() => {
    const first = parseDateString(days[0]);
    const last = parseDateString(days[6]);
    const month = (d: Date) => d.toLocaleDateString("en-US", { month: "long" });
    return first.getMonth() === last.getMonth()
      ? `${month(first)} ${first.getFullYear()}`
      : `${month(first).slice(0, 3)} – ${month(last).slice(0, 3)} ${last.getFullYear()}`;
  })();

  const moveWeek = (weeks: number) => {
    let next = shiftWeeks(value, weeks);
    // Stepping back past today lands on today rather than a day you can't pick.
    if (minDate && next < minDate) next = minDate;
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-1.5">
        <span className="text-[13px] font-medium text-muted-foreground">
          {monthLabel}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => moveWeek(-1)}
            disabled={!canGoBack}
            aria-label="Previous week"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)] disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => moveWeek(1)}
            aria-label="Next week"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((dateKey) => {
          const date = parseDateString(dateKey);
          const selected = dateKey === value;
          const isToday = dateKey === todayKey;
          const disabled = !!minDate && dateKey < minDate;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onChange(dateKey)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              className="flex flex-col items-center gap-1 rounded-xl py-1 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span
                className={cn(
                  "text-[11px] font-medium",
                  selected ? "text-[var(--primary)]" : "text-muted-foreground"
                )}
              >
                {date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
              </span>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[15px] font-semibold transition-colors",
                  selected
                    ? "bg-[var(--primary)] text-white shadow-[var(--shadow-warm)]"
                    : isToday
                      ? "text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                      : "text-foreground"
                )}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
