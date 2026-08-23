import { formatDateString } from "@/lib/utils";

/**
 * Reading the free-form date an extraction wrote onto an event.
 *
 * This used to be `new Date(str)` with the weekday stripped off the front, and
 * that is a trap rather than a shortcut: V8 will accept almost anything and
 * invent the rest. Measured, on the strings this app actually stores:
 *
 *   "September 5-6"        -> Sep 5 **2006**   (the 6 became the year)
 *   "March 21 & 22"        -> Mar 21 **2022**
 *   "November 14"          -> Nov 14 **2001**
 *   "2026-11-14"           -> Nov **13** 2026  (parsed UTC, read local)
 *   "September 5–6"        -> Invalid          (en dash)
 *   "December 6th"         -> Invalid          (ordinal suffix)
 *   "Nov 14 - Nov 16, 2026"-> Invalid
 *
 * Both halves of that hurt. An Invalid Date means "Go to this day in the
 * planner" silently lands on today, and it means the week view never
 * auto-injects the event at all. A wrongly-invented year is worse: the planner
 * jumps to 2006 and the event is filed two decades away from the week it
 * belongs to.
 *
 * So this reads the string on purpose instead: find a month and a day, find a
 * year if one is written down, and refuse anything it cannot identify. A range
 * resolves to the first date in it — "September 5–6" is an event you attend
 * starting on the 5th.
 */

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length);
const MONTH_ALTERNATION = MONTH_NAMES.join("|");

const MONTH_DAY = new RegExp(`\\b(${MONTH_ALTERNATION})\\.?\\s+(\\d{1,2})\\b`);
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_ALTERNATION})\\b`);
const ISO = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;
const SLASHED = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const YEAR = /\b(19|20)\d{2}\b/;

/**
 * How far into the past a year-less date is still taken at face value.
 *
 * "December 6th" saved in August means this December. "January 3rd" saved in
 * August means next January, not the one seven months gone. Six months puts the
 * boundary halfway between the two readings, which is the least surprising
 * place for it.
 */
const BACKWARD_GRACE_MONTHS = 6;

/** Strip what a human writes and a parser cannot use. */
function normalise(dateStr: string): string {
  return dateStr
    .toLowerCase()
    // En and em dashes are what a model writes for a range; a plain hyphen is
    // what a person writes. Both mean the same thing here.
    .replace(/[‐-―]/g, "-")
    // 1st, 2nd, 3rd, 14th
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** The year to assume when the string does not say. */
function inferYear(month: number, day: number, now: Date): number {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - BACKWARD_GRACE_MONTHS);
  const thisYear = new Date(now.getFullYear(), month, day);
  return thisYear < cutoff ? now.getFullYear() + 1 : now.getFullYear();
}

/** A local Date, or null when the parts do not describe a real day. */
function buildDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  // Rejects Feb 30 and friends, which JS would roll forward into March.
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

/** Month and day, from whichever way round they are written. */
function findMonthAndDay(text: string): { month: number; day: number } | null {
  const monthFirst = MONTH_DAY.exec(text);
  if (monthFirst) {
    return { month: MONTHS[monthFirst[1]], day: Number(monthFirst[2]) };
  }
  const dayFirst = DAY_MONTH.exec(text);
  if (dayFirst) {
    return { month: MONTHS[dayFirst[2]], day: Number(dayFirst[1]) };
  }
  return null;
}

/**
 * Parse a free-form event date, optionally with a separate time string, into a
 * local Date. Returns null when the string does not name a specific day —
 * "TBD", "Every Saturday" and "September 2026" all qualify.
 *
 * `now` is injectable so the year-inference rule can be tested without moving
 * the clock.
 */
export function parseEventDate(
  dateStr?: string,
  timeStr?: string,
  now: Date = new Date(),
): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;

  const text = normalise(dateStr);
  if (!text) return null;

  let parsed: Date | null = null;

  const iso = ISO.exec(text);
  if (iso) {
    // Built by hand rather than handed to Date: `new Date("2026-11-14")` is
    // parsed as UTC midnight, which reads as the 13th anywhere west of London.
    parsed = buildDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  if (!parsed) {
    const found = findMonthAndDay(text);
    if (found) {
      // The year is looked for across the whole string, not just after the
      // day, so "September 5–6, 2026" and "Nov 14 - Nov 16, 2026" both find it.
      const year = YEAR.exec(text);
      parsed = buildDate(
        year ? Number(year[0]) : inferYear(found.month, found.day, now),
        found.month,
        found.day,
      );
    }
  }

  // Last, because a bare pair of numbers is the most easily mistaken for
  // something that is not a date at all — "7/9 sold" is not July 9th.
  if (!parsed) {
    const slashed = SLASHED.exec(text);
    if (slashed) {
      const rawYear = slashed[3] ? Number(slashed[3]) : null;
      const year =
        rawYear === null
          ? inferYear(Number(slashed[1]) - 1, Number(slashed[2]), now)
          : rawYear < 100
            ? rawYear + 2000
            : rawYear;
      parsed = buildDate(year, Number(slashed[1]) - 1, Number(slashed[2]));
    }
  }

  if (!parsed) return null;

  applyTime(parsed, timeStr);
  return parsed;
}

/** Set the wall-clock time on an already-parsed day, if one was given. */
function applyTime(date: Date, timeStr?: string): void {
  if (!timeStr) return;
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2] || "0", 10);
  if (hours > 23 || minutes > 59) return;

  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  date.setHours(hours, minutes, 0, 0);
}

/**
 * The planner's `?date=` query string for an event's free-form date, or null
 * when the date can't be parsed.
 *
 * Returning null rather than falling back to today matters: "go to this day"
 * landing silently on the wrong day is worse than the row not offering the
 * jump at all, so the caller can decide to send the user to the plain planner
 * instead of pretending it knew when the event was.
 */
export function toPlannerDateParams(dateStr?: string): string | null {
  const parsed = parseEventDate(dateStr);
  if (!parsed) return null;
  return `date=${formatDateString(parsed)}`;
}

/**
 * Convert a locally-parsed event Date into the UTC-encoded ISO string
 * convention used by plan_items.planned_date (calendar day and wall-clock
 * time stored in the UTC fields).
 */
export function eventDateToPlannedDate(eventDate: Date): string {
  return new Date(
    Date.UTC(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
      eventDate.getHours(),
      eventDate.getMinutes(),
      0,
      0,
    ),
  ).toISOString();
}
