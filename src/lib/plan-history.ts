/**
 * What an item's planning history says about it (PLA-46).
 *
 * Pure, and separate from the query that feeds it, because every interesting
 * decision here is a judgement about when a number is worth showing rather
 * than about how to fetch it.
 *
 * The guiding rule: say nothing rather than say something shaky. A "usually
 * Tuesdays" drawn from two occurrences is noise wearing the costume of a
 * finding, and the cook will notice it is wrong long before they notice it is
 * useful.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface PlanHistorySummary {
  /** Occurrences strictly in the past. */
  timesPlanned: number;
  /** Most recent past occurrence, ISO. Null when it has never been planned. */
  lastPlanned: string | null;
  /**
   * Whole calendar days between `lastPlanned` and now.
   *
   * Calendar days, not elapsed milliseconds: something eaten at 8pm yesterday
   * is "1 day ago" at 9am today, not "0 days ago", because that is what a
   * person means.
   */
  daysSince: number | null;
  /** The soonest future occurrence, ISO. Null when nothing is scheduled. */
  nextPlanned: string | null;
  /**
   * The weekday this lands on more often than chance would suggest, or null.
   *
   * Requires at least MIN_FOR_PATTERN occurrences and a genuine plurality —
   * see `usualDayOf`.
   */
  usualDay: string | null;
}

/** Below this, a "usually X" claim is being made from too little. */
export const MIN_FOR_PATTERN = 4;

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

/**
 * The weekday an item genuinely favours, or null.
 *
 * Two guards, both there to stop a coincidence being reported as a habit:
 * enough occurrences to mean anything, and a mode that beats the runner-up
 * outright. A 3–3 split between Tuesday and Friday is not "usually Tuesdays",
 * it is a thing eaten twice a week, and naming one of them would be wrong half
 * the time.
 */
export function usualDayOf(dates: readonly Date[]): string | null {
  if (dates.length < MIN_FOR_PATTERN) return null;

  const counts = new Array(7).fill(0);
  for (const date of dates) counts[date.getDay()] += 1;

  const sorted = [...counts].sort((a, b) => b - a);
  if (sorted[0] === sorted[1]) return null;

  return WEEKDAYS[counts.indexOf(sorted[0])];
}

/**
 * Summarise the dates an item has been planned for.
 *
 * Takes every occurrence, past and future, and splits them here rather than
 * asking the caller to: "planned 6 times" meaning six *past* times while
 * "next Friday" means a future one is a distinction worth making in one place.
 */
export function summarisePlanHistory(
  plannedDates: readonly string[],
  now: Date = new Date()
): PlanHistorySummary {
  const parsed = plannedDates
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  // Today counts as past: an item planned for tonight has effectively been
  // had, and calling it "upcoming" all day is pedantic.
  const todayStart = startOfDay(now);
  const past = parsed.filter((d) => startOfDay(d) <= todayStart);
  const future = parsed.filter((d) => startOfDay(d) > todayStart);

  const last = past.length > 0 ? past[past.length - 1] : null;

  return {
    timesPlanned: past.length,
    lastPlanned: last ? last.toISOString() : null,
    daysSince: last ? calendarDaysBetween(last, now) : null,
    nextPlanned: future.length > 0 ? future[0].toISOString() : null,
    usualDay: usualDayOf(past),
  };
}

/** "21 days ago", "Yesterday", "Today" — the phrase, not the number. */
export function describeDaysSince(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} weeks ago`;
  }
  const months = Math.round(days / 30);
  return `${months} months ago`;
}
