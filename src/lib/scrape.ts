// Shared helpers for the TikTok / Instagram / website scrapers, which each
// previously carried their own copy of these.

/**
 * Decode the HTML entities that show up in scraped titles/descriptions. This
 * is the union of what the per-scraper copies handled (named entities, the
 * common hex escapes, non-breaking space, and generic numeric entities), so
 * it decodes a strict superset — never less than any single old copy did.
 */
export function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Resolve a URL to its final destination by following redirects. Tries a HEAD
 * request first, falls back to GET, and returns the original URL if both fail.
 * Callers apply their own platform-specific "is this actually a short URL"
 * guard before calling.
 */
export async function followRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return response.url;
  } catch {
    try {
      const response = await fetch(url, { redirect: "follow" });
      return response.url;
    } catch {
      return url;
    }
  }
}
