import { formatDateString } from "@/lib/date-utils";

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function monthIndexFromName(name: string): number {
  const lower = name.toLowerCase();
  return MONTH_NAMES.findIndex(
    (m) => m === lower || (lower.length >= 3 && m.startsWith(lower)),
  );
}

function buildDate(year: number, monthIndex: number, day: number): string | null {
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, monthIndex, day);
  // Reject overflow like Feb 30 (which JS rolls into March)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return formatDateString(date);
}

function normalizeYear(raw: string | undefined, today: Date): number {
  if (!raw) return today.getFullYear();
  const year = parseInt(raw, 10);
  return raw.length === 2 ? 2000 + year : year;
}

/**
 * Interpret a free-form search query as a calendar date.
 * Supports "today"/"tomorrow"/"yesterday", YYYY-MM-DD, M/D(/YYYY),
 * and month-name formats like "July 4" or "Jul 4, 2026".
 * Returns a YYYY-MM-DD string, or null if the query isn't a date.
 */
export function parseSearchDate(
  query: string,
  today: Date = new Date(),
): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  if (q === "today" || q === "tomorrow" || q === "yesterday") {
    const d = new Date(today);
    if (q === "tomorrow") d.setDate(d.getDate() + 1);
    if (q === "yesterday") d.setDate(d.getDate() - 1);
    return formatDateString(d);
  }

  // YYYY-MM-DD
  const iso = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return buildDate(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10),
    );
  }

  // M/D, M/D/YY, M/D/YYYY
  const slash = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (slash) {
    return buildDate(
      normalizeYear(slash[3], today),
      parseInt(slash[1], 10) - 1,
      parseInt(slash[2], 10),
    );
  }

  // "July 4", "Jul 4 2026", "July 4, 2026"
  const monthFirst = q.match(
    /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{2}|\d{4}))?$/,
  );
  if (monthFirst) {
    const monthIndex = monthIndexFromName(monthFirst[1]);
    if (monthIndex === -1) return null;
    return buildDate(
      normalizeYear(monthFirst[3], today),
      monthIndex,
      parseInt(monthFirst[2], 10),
    );
  }

  // "4 July", "4 July 2026"
  const dayFirst = q.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?(?:,?\s+(\d{2}|\d{4}))?$/,
  );
  if (dayFirst) {
    const monthIndex = monthIndexFromName(dayFirst[2]);
    if (monthIndex === -1) return null;
    return buildDate(
      normalizeYear(dayFirst[3], today),
      monthIndex,
      parseInt(dayFirst[1], 10),
    );
  }

  return null;
}
