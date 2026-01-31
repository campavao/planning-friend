import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(value: string) {
  // Check if it starts with + (has country code)
  const hasCountryCode = value.startsWith("+");

  // Remove all non-digits
  const digits = value.replace(/\D/g, "");

  // Handle numbers with country code (11+ digits, e.g., +1 for US)
  if (hasCountryCode || digits.length > 10) {
    // Assume first 1 digit is country code for US/Canada (+1)
    // For other countries, this may need adjustment
    const countryCode = digits.slice(0, 1);
    const nationalNumber = digits.slice(1);

    if (nationalNumber.length <= 3) {
      return `+${countryCode} ${nationalNumber}`;
    } else if (nationalNumber.length <= 6) {
      return `+${countryCode} (${nationalNumber.slice(
        0,
        3
      )}) ${nationalNumber.slice(3)}`;
    } else {
      return `+${countryCode} (${nationalNumber.slice(
        0,
        3
      )}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6, 10)}`;
    }
  }

  // Format as (XXX) XXX-XXXX for 10-digit numbers without country code
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
      6,
      10
    )}`;
  }
}

/**
 * Parse a date string in YYYY-MM-DD format to a local Date object.
 * This avoids timezone issues that occur when using new Date(dateString).
 */
export function parseDateString(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object to YYYY-MM-DD string in local time.
 * This avoids timezone issues that occur when using toISOString().
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================
// Week Start Day Configuration
// ============================================

// localStorage key for week start day preference
export const WEEK_START_STORAGE_KEY = "planner_week_start_day";

// Day names starting from Sunday (JS Date.getDay() order)
const DAYS_FROM_SUNDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL_FROM_SUNDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Get the user's preferred week start day from localStorage.
 * Returns 0-6 where 0=Sunday, 1=Monday, etc.
 * Default is 0 (Sunday).
 */
export function getWeekStartDay(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = localStorage.getItem(WEEK_START_STORAGE_KEY);
    if (stored !== null) {
      const day = parseInt(stored, 10);
      if (day >= 0 && day <= 6) return day;
    }
  } catch {
    // Ignore storage errors
  }
  return 0; // Default: Sunday
}

/**
 * Save the user's preferred week start day to localStorage.
 * @param day 0-6 where 0=Sunday, 1=Monday, etc.
 */
export function setWeekStartDay(day: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WEEK_START_STORAGE_KEY, String(day));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get day name arrays ordered by the user's week start preference.
 * @param startDay 0-6 where 0=Sunday, 1=Monday, etc.
 * @returns Object with short and full day name arrays
 */
export function getOrderedDays(startDay: number): {
  days: string[];
  daysFull: string[];
} {
  const days: string[] = [];
  const daysFull: string[] = [];

  for (let i = 0; i < 7; i++) {
    const dayIndex = (startDay + i) % 7;
    days.push(DAYS_FROM_SUNDAY[dayIndex]);
    daysFull.push(DAYS_FULL_FROM_SUNDAY[dayIndex]);
  }

  return { days, daysFull };
}

/**
 * Calculate the week start date for a given date based on user's preferred start day.
 * @param date The date to find the week start for
 * @param startDay 0-6 where 0=Sunday, 1=Monday, etc.
 * @returns The week start date as YYYY-MM-DD string
 */
export function getWeekStartForDate(
  date: Date = new Date(),
  startDay: number = 0
): string {
  const d = new Date(date);
  const currentDay = d.getDay(); // 0=Sunday, 6=Saturday

  // Calculate days to subtract to get to the start day
  // If current day is before start day, we need to go back further
  let daysToSubtract = currentDay - startDay;
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }

  d.setDate(d.getDate() - daysToSubtract);
  d.setHours(0, 0, 0, 0);
  return formatDateString(d);
}

/**
 * Convert an absolute date to a day slot (0-6) within a week.
 * @param itemDate The date of the item (YYYY-MM-DD or Date)
 * @param weekStart The week start date (YYYY-MM-DD)
 * @returns Day slot 0-6, or -1 if outside the week
 */
export function getDateSlotInWeek(
  itemDate: string | Date,
  weekStart: string
): number {
  const item =
    typeof itemDate === "string" ? parseDateString(itemDate) : itemDate;
  const start = parseDateString(weekStart);

  const diffTime = item.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays > 6) {
    return -1; // Outside this week
  }
  return diffDays;
}
