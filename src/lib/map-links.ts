/**
 * Deep links for the "get me there" actions on a saved location.
 *
 * Both builders accept optional coordinates. Nothing stores them today — EXIF
 * GPS is read in image-processing.ts, handed to Gemini as prompt context, and
 * then dropped — so every caller currently takes the address path. The
 * parameter exists so that persisting coordinates later is a threading change
 * rather than a rewrite of the link logic.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Google's universal Maps URL. The iOS and Android Google Maps apps both claim
 * this host, so a single link opens the native app when it is installed and the
 * web map when it is not — no platform sniffing or custom scheme needed.
 */
export function getGoogleMapsUrl(
  location: string,
  coordinates?: Coordinates
): string {
  const query = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

/**
 * Route to our own redirect rather than straight to Uber.
 *
 * Uber will not pre-fill a destination from `dropoff[formatted_address]` — that
 * parameter is only a display label, so linking directly opened the app with an
 * empty destination. Only `dropoff[latitude]`/`dropoff[longitude]` actually set
 * it. /api/uber geocodes the address server-side (cached indefinitely) and then
 * redirects with real coordinates attached.
 *
 * `nickname` is the item's title, which Uber shows as the destination's name.
 */
export function getUberUrl(location: string, nickname?: string): string {
  const params = new URLSearchParams({ q: location });
  if (nickname) params.set("n", nickname);
  return `/api/uber?${params.toString()}`;
}
