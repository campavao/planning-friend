/**
 * Turning the planner's stored dates into real moments.
 *
 * `plan_items.planned_date` does not hold an instant. It holds a calendar day
 * and a wall-clock time parked in the UTC fields of an ISO string: a 7pm dinner
 * is stored as `...T19:00:00.000Z` and read back with `getUTCHours()`. That is
 * deliberate and it is right — a plan is a calendar, so a dinner is at 7pm
 * wherever you happen to be reading the page from, and every view in the app
 * renders it with `timeZone: "UTC"` to keep it that way.
 *
 * It only breaks when something needs a real moment. The note-reminder cron
 * asked "is now past planned + 2h?" by passing that string to `new Date()`,
 * which reads 19:00 as 19:00 UTC — 2pm in Chicago. So the reminder for a 7pm
 * dinner came due at 4pm and arrived before the meal it was asking about,
 * earlier by exactly the reader's offset from UTC.
 *
 * Resolving it needs the one thing the string does not carry: which zone that
 * wall clock belongs to.
 */

export const FALLBACK_TIME_ZONE = "UTC";

/**
 * The widest real UTC offset, used to pad any query window that has to catch
 * wall-clock times from every zone. Kiribati is +14.
 */
export const MAX_UTC_OFFSET_MINUTES = 14 * 60;

/** Whether a string names a zone this runtime knows. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A stored zone, or UTC — which is what the app assumed before it stored any. */
export function resolveTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : FALLBACK_TIME_ZONE;
}

/**
 * How far `timeZone` is from UTC at a given moment, in milliseconds.
 *
 * Read out of Intl rather than tabulated, so daylight saving is handled by the
 * runtime's own zone data instead of by us guessing when it starts.
 */
function offsetMsAt(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    // Intl renders midnight as hour 24 in some locales/runtimes.
    read("hour") % 24,
    read("minute"),
    read("second")
  );
  return asIfUtc - at.getTime();
}

/**
 * The real moment a stored wall-clock date refers to, for someone in
 * `timeZone`.
 *
 * The offset is looked up twice because the first lookup uses the wrong
 * instant: to know the offset you need the moment, and to know the moment you
 * need the offset. One correction is enough everywhere except inside a DST
 * transition itself, where an hour either does not exist or happens twice and
 * no answer is right.
 */
export function wallClockToInstant(
  wallClockIso: string,
  timeZone: string
): Date | null {
  const wall = new Date(wallClockIso);
  if (Number.isNaN(wall.getTime())) return null;

  const zone = resolveTimeZone(timeZone);
  if (zone === FALLBACK_TIME_ZONE) return wall;

  const wallMs = wall.getTime();
  const firstGuess = wallMs - offsetMsAt(zone, wall);
  const corrected = wallMs - offsetMsAt(zone, new Date(firstGuess));
  return new Date(corrected);
}
