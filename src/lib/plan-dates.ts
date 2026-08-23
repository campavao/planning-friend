/**
 * Format a Date's UTC components as YYYY-MM-DD. Plan items store their
 * calendar day in the UTC portion of planned_date, so day bucketing and
 * search results must read UTC parts, not local time.
 */
export function formatUtcDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DatedItem {
  planned_date?: string | null;
  shared_date?: string | null;
}

/** The YYYY-MM-DD calendar day a plan item belongs to, or null. */
export function getItemDateKey(item: DatedItem): string | null {
  if (item.planned_date) {
    const planned = new Date(item.planned_date);
    if (!Number.isNaN(planned.getTime())) {
      return formatUtcDateString(planned);
    }
  }
  if (item.shared_date) {
    return item.shared_date;
  }
  return null;
}

/** Display time (e.g. "7:00 PM") for a plan item, or null. */
export function formatItemTime(item: DatedItem): string | null {
  if (!item.planned_date) return null;
  const planned = new Date(item.planned_date);
  if (Number.isNaN(planned.getTime())) return null;
  return planned.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * The next fortnight, as options for "add this to a day".
 *
 * A list rather than a date picker: adding a saved recipe to the plan is a
 * next-few-days decision almost every time, and a scrollable list of real days
 * is one tap where a calendar widget is three. Anything further out is what the
 * planner itself is for.
 *
 * Times are set to 19:00 local, matching the slot the planner's own add flow
 * defaults to, so an item added from either place lands in the same place.
 */
export interface UpcomingDay {
  date: Date;
  /** "Today", "Tomorrow", or the weekday name. */
  label: string;
  /** "Aug 27" — always shown, because "Tuesday" alone is ambiguous twice over. */
  sub: string;
}

export function upcomingDays(count = 14, from: Date = new Date()): UpcomingDay[] {
  const out: UpcomingDay[] = [];
  const start = new Date(from);
  start.setHours(19, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : date.toLocaleDateString("en-US", { weekday: "long" });
    out.push({
      date,
      label,
      sub: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}
