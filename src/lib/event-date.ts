/**
 * Parse a free-form event date string (e.g. "Saturday, April 18, 2026")
 * plus optional time (e.g. "7:30 PM") into a local Date.
 * Shared by the planner week view (auto-injected events) and planner search.
 */
export function parseEventDate(
  dateStr?: string,
  timeStr?: string,
): Date | null {
  if (!dateStr) return null;

  // Try parsing the date string directly - works for many natural formats
  // Remove day-of-week prefix like "Saturday, " if present
  const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, "");
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    // Apply time if provided
    if (timeStr) {
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2] || "0", 10);
        const period = timeMatch[3]?.toUpperCase();
        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        parsed.setHours(hours, minutes, 0, 0);
      }
    }
    return parsed;
  }

  return null;
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
