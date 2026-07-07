"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const triggerClass =
  "data-[size=default]:h-9 rounded-lg border-0 bg-[var(--card)] px-2 text-sm font-medium focus:ring-2 focus:ring-[var(--primary)]/40";

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
      <Select
        value={String(month)}
        onValueChange={(v) => jumpTo(year, parseInt(v, 10), day)}
      >
        <SelectTrigger aria-label="Month" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((label, i) => (
            <SelectItem key={label} value={String(i)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(day)}
        onValueChange={(v) => jumpTo(year, month, parseInt(v, 10))}
      >
        <SelectTrigger aria-label="Day" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(
            (d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
      <Select
        value={String(year)}
        onValueChange={(v) => jumpTo(parseInt(v, 10), month, day)}
      >
        <SelectTrigger aria-label="Year" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
