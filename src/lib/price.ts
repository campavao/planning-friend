/**
 * A price worth showing, or nothing.
 *
 * Extraction sometimes fills a price field with the model's own commentary —
 * "Not mentioned", "Not explicitly mentioned", "Unknown", "Varies" — and a pill
 * reading "Not mentioned" is worse than no pill. A real price has a figure or a
 * currency symbol in it ("$29.99", "$$", "Under 20"), or says it's free.
 */
const PRICE_LIKE = /[\d$€£¥₹]|\bfree\b/i;

export function displayPrice(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && PRICE_LIKE.test(trimmed) ? trimmed : undefined;
}
