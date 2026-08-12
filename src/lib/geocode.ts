// Nominatim ToS requires a custom User-Agent identifying the application —
// stock fetch UAs are blocked. Include a contact so they can reach us if
// we ever do something abusive. See https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT =
  "planning-friend/0.1 (https://github.com/campavao/planning-friend; cam9548@gmail.com)";

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Resolve a free-text address to coordinates. Returns null on any failure —
 * callers are expected to degrade rather than surface an error, since this
 * only ever enriches a link.
 */
export async function geocodeAddress(
  query: string
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      // Addresses are stable forever — cache indefinitely. This is also what
      // keeps us inside Nominatim's 1 req/sec limit: a given venue is only
      // ever looked up once. Tagged so a bad result can be invalidated.
      cache: "force-cache",
      next: { tags: [`geocode:${q}`] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
