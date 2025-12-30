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
