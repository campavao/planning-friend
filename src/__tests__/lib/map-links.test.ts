/**
 * Tests for the map/ride deep link builders.
 * Imports real functions — no duplicated logic.
 */

import { getGoogleMapsUrl, getUberUrl } from "@/lib/map-links";

// ============================================
// getGoogleMapsUrl
// ============================================
describe("getGoogleMapsUrl", () => {
  it("encodes a plain address", () => {
    expect(getGoogleMapsUrl("Central Park")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Central%20Park"
    );
  });

  it("percent-encodes commas so they survive the query string", () => {
    expect(getGoogleMapsUrl("123 Main St, New York, NY 10001")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20New%20York%2C%20NY%2010001"
    );
  });

  it("encodes accented and non-latin characters as UTF-8", () => {
    expect(getGoogleMapsUrl("Café de Flore, Saint-Germain")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20de%20Flore%2C%20Saint-Germain"
    );
    expect(getGoogleMapsUrl("東京タワー")).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC"
    );
  });

  it("encodes ampersands so they do not split the query", () => {
    expect(getGoogleMapsUrl("Ben & Jerry's")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Ben%20%26%20Jerry's"
    );
  });

  it("prefers coordinates over the address when they are available", () => {
    expect(
      getGoogleMapsUrl("Café de Flore", {
        latitude: 48.854,
        longitude: 2.3324,
      })
    ).toBe("https://www.google.com/maps/search/?api=1&query=48.854%2C2.3324");
  });

  it("keeps negative coordinates intact", () => {
    expect(
      getGoogleMapsUrl("Sydney Opera House", {
        latitude: -33.8568,
        longitude: 151.2153,
      })
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=-33.8568%2C151.2153"
    );
  });
});

// ============================================
// getUberUrl
// ============================================
describe("getUberUrl", () => {
  // These assert the shape of OUR url, not Uber's behaviour. The previous
  // version of this suite passed while the feature was broken in the app:
  // it linked straight to m.uber.com with only dropoff[formatted_address],
  // which Uber treats as a display label and ignores as a destination. The
  // real fix lives in /api/uber, which attaches geocoded coordinates.
  it("routes through our geocoding redirect rather than straight to Uber", () => {
    expect(getUberUrl("Central Park")).toBe("/api/uber?q=Central+Park");
  });

  it("never links directly to m.uber.com", () => {
    expect(getUberUrl("Central Park")).not.toContain("m.uber.com");
  });

  it("passes the item title through as the destination nickname", () => {
    expect(getUberUrl("4662 N Broadway, Chicago, IL 60640", "Cariño")).toBe(
      "/api/uber?q=4662+N+Broadway%2C+Chicago%2C+IL+60640&n=Cari%C3%B1o"
    );
  });

  it("omits the nickname param when there is no title", () => {
    expect(getUberUrl("Central Park")).not.toContain("n=");
  });

  it("encodes commas, accents and non-latin characters", () => {
    expect(getUberUrl("Café de Flore, Saint-Germain")).toBe(
      "/api/uber?q=Caf%C3%A9+de+Flore%2C+Saint-Germain"
    );
    expect(getUberUrl("東京タワー")).toBe(
      "/api/uber?q=%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC"
    );
  });
});
