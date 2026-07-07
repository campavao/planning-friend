"use client";

import { formatDateString, parseDateString } from "@/lib/date-utils";
import { useMemo } from "react";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface DateJumpControlsProps {
  /** The date currently in focus, YYYY-MM-DD */
  anchorDate: string;
  onJump: (dateKey: string) => void;
}

const selectClass =
  "h-9 rounded-lg bg-[var(--card)] px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function DateJumpControls({ anchorDate, onJump }: DateJumpControlsProps) {
  const anchor = parseDateString(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const min = Math.min(year, current - 10);
    const max = Math.max(year, current + 10);
    const list: number[] = [];
    for (let y = min; y <= max; y++) list.push(y);
    return list;
  }, [year]);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const jumpTo = (y: number, m: number, d: number) => {
    const clampedDay = Math.min(d, daysInMonth(y, m));
    onJump(formatDateString(new Date(y, m, clampedDay)));
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Month"
        className={selectClass}
        value={month}
        onChange={(e) => jumpTo(year, parseInt(e.target.value, 10), day)}
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={label} value={i}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Day"
        className={selectClass}
        value={day}
        onChange={(e) => jumpTo(year, month, parseInt(e.target.value, 10))}
      >
        {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(
          (d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ),
        )}
      </select>
      <select
        aria-label="Year"
        className={selectClass}
        value={year}
        onChange={(e) => jumpTo(parseInt(e.target.value, 10), month, day)}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
