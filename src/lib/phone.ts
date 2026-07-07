// Normalize a phone number to E.164 format (e.g. "+15551234567").
// Assumes US when no country code is present.
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else if (normalized.length === 11 && normalized.startsWith("1")) {
      normalized = "+" + normalized;
    }
  }

  return normalized;
}
