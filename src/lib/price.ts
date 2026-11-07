/**
 * A price worth showing, or nothing.
 *
 * Extraction sometimes fills a price field with the model's own commentary —
 * "Not mentioned", "Not explicitly mentioned", "Unknown", "Varies" — and a pill
 * reading "Not mentioned" is worse than no pill. A real price has a figure or a
 * currency symbol in it ("$29.99", "$$", "Under 20"), or says it's free.
 */
const PRICE_LIKE = /[\d$€£¥₹]|\bfree\b/i;

/**
 * The model's way of saying it doesn't know, even when a figure rides along:
 * "Price not mentioned (includes $25 McDonald's gift card)" has a "$25" in it
 * but is not a price.
 */
const NOT_A_PRICE =
  /\b(not|no)\s+(explicitly\s+)?(mentioned|specified|listed|given|stated|available|provided)\b|\bunknown\b|\bn\/a\b|\bvaries\b/i;

/** Longer than this, it's a sentence about the price, not the price. */
const MAX_PRICE_LENGTH = 24;

export function displayPrice(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PRICE_LENGTH) return undefined;
  if (NOT_A_PRICE.test(trimmed)) return undefined;
  return PRICE_LIKE.test(trimmed) ? trimmed : undefined;
}
