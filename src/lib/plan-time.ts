import {
  formatDateString,
  getWeekStartForDate,
  parseDateString,
} from "@/lib/utils";

/**
 * Picking when something happens, shared by every "put this on a day" sheet.
 *
 * A plan item keeps its calendar day and time in the UTC parts of
 * `planned_date` — the server buckets by the ISO date, and the planner reads
 * the UTC hour back as the time. `plannedDateFor` is the one place that turns a
 * chosen day and time into that shape, so the planner and the item page can't
 * drift apart again. (The item page used to send 7 PM local time, which for
 * anyone west of UTC is already tomorrow by the ISO date, so the item landed a
 * day late.)
 */

export interface TimePreset {
  label: string;
  /** "HH:MM", 24-hour. */
  value: string;
}

export const TIME_PRESETS: TimePreset[] = [
  { label: "Breakfast", value: "09:00" },
  { label: "Lunch", value: "12:00" },
  { label: "Dinner", value: "19:00" },
];

export const DEFAULT_PLAN_TIME = "19:00";

/** ISO timestamp for a YYYY-MM-DD day at "HH:MM", in the planner's UTC form. */
export function plannedDateFor(dateKey: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{1,2}:\d{2}$/.test(time)) {
    return null;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes || 0, 0, 0)
  ).toISOString();
}

/** "19:00" → "7:00 PM". */
export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes || 0).padStart(2, "0")} ${suffix}`;
}

/** The seven YYYY-MM-DD days of the week containing `dateKey`. */
export function weekDays(dateKey: string, weekStartDay: number): string[] {
  const start = parseDateString(
    getWeekStartForDate(parseDateString(dateKey), weekStartDay)
  );
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return formatDateString(day);
  });
}

/** The same weekday `weeks` weeks away. */
export function shiftWeeks(dateKey: string, weeks: number): string {
  const date = parseDateString(dateKey);
  date.setDate(date.getDate() + weeks * 7);
  return formatDateString(date);
}

/** "Dinner" for a preset time, "6:30 PM" for any other. */
export function describeTime(time: string): string {
  return (
    TIME_PRESETS.find((preset) => preset.value === time)?.label ??
    formatTimeLabel(time)
  );
}

/** "Sat, Nov 8" — short enough for a sheet title or a button. */
export function shortDayLabel(dateKey: string): string {
  return parseDateString(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
