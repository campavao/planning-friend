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
 * Whether a day shows its suggestion strip.
 *
 * Extracted from WeekSection because inlining it produced a real bug: the
 * toggle was prefixed onto an existing `empty || hasPicks` expression without
 * parentheses, and `&&` binds tighter than `||`, so it became
 * `(!hidden && empty) || hasPicks` — every day with picks ignored the toggle
 * entirely. A three-argument boolean is worth testing precisely because it is
 * the kind of thing that looks obviously right while being wrong.
 *
 * `hidden` short-circuits everything: off has to mean off, including on an
 * empty day where the strip would otherwise stay to explain itself.
 */
export function shouldShowSuggestions(
  hidden: boolean,
  plannedCount: number,
  pickCount: number
): boolean {
  if (hidden) return false;
  // An empty day keeps the strip even with no picks, so it can say why it is
  // empty rather than rendering blank.
  return plannedCount === 0 || pickCount > 0;
}
