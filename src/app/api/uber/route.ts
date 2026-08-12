import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

export const runtime = "nodejs";

// GET /api/uber?q=<address>&n=<nickname>
//
// Geocodes the address via Nominatim (cached indefinitely), builds an Uber
// universal deep link with real coords, and 302s to it. Coords are what makes
// the dropoff actually pre-fill in the Uber app — `dropoff[formatted_address]`
// alone is just a display label, which is why the direct link opened Uber with
// an empty destination.
//
// Geocoding happens here rather than in the browser so the Nominatim call is
// cached once per address across every user, and so the ToS-required
// User-Agent is actually ours.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("q") || "").trim();
  const nickname = (searchParams.get("n") || "").trim();

  const params = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
  });
  if (address) params.set("dropoff[formatted_address]", address);
  if (nickname) params.set("dropoff[nickname]", nickname);

  if (address) {
    const geo = await geocodeAddress(address);
    if (geo) {
      params.set("dropoff[latitude]", String(geo.lat));
      params.set("dropoff[longitude]", String(geo.lng));
    }
  }

  // Optional: Uber honours deep link params more reliably for a registered
  // app. Works without it, so this stays unset until an app is registered.
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
  if (clientId) params.set("client_id", clientId);

  // A failed geocode still redirects — the rider lands in Uber with the
  // address as a label rather than nothing at all, which is no worse than
  // before and better than an error page.
  return NextResponse.redirect(`https://m.uber.com/ul/?${params.toString()}`);
}
