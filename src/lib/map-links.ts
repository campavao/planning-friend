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
 * Uber's universal link. The Uber app intercepts m.uber.com/ul when installed;
 * otherwise the same URL renders the mobile web ride request, so there is no
 * dead link to guard against.
 */
export function getUberUrl(
  location: string,
  coordinates?: Coordinates
): string {
  // Uber resolves `my_location` from the device, which is what turns this into
  // a one-tap action instead of dropping the rider on a pickup picker.
  const params = ["action=setPickup", "pickup=my_location"];

  // Uber geocodes a formatted address itself and can land on the wrong branch of
  // a chain, so coordinates take priority whenever we have them. The address
  // still rides along as the human-readable label on the destination pin.
  if (coordinates) {
    params.push(`dropoff[latitude]=${coordinates.latitude}`);
    params.push(`dropoff[longitude]=${coordinates.longitude}`);
  }
  params.push(`dropoff[formatted_address]=${encodeURIComponent(location)}`);

  return `https://m.uber.com/ul/?${params.join("&")}`;
}
