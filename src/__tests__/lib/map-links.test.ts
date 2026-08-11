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
  it("builds an address dropoff with the rider's current location as pickup", () => {
    expect(getUberUrl("Central Park")).toBe(
      "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=Central%20Park"
    );
  });

  it("percent-encodes commas in the address", () => {
    expect(getUberUrl("123 Main St, New York, NY 10001")).toBe(
      "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=123%20Main%20St%2C%20New%20York%2C%20NY%2010001"
    );
  });

  it("encodes accented and non-latin characters as UTF-8", () => {
    expect(getUberUrl("Café de Flore, Saint-Germain")).toBe(
      "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=Caf%C3%A9%20de%20Flore%2C%20Saint-Germain"
    );
    expect(getUberUrl("東京タワー")).toBe(
      "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC"
    );
  });

  it("adds a coordinate dropoff and keeps the address as the pin label", () => {
    expect(
      getUberUrl("Café de Flore", { latitude: 48.854, longitude: 2.3324 })
    ).toBe(
      "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=48.854&dropoff[longitude]=2.3324&dropoff[formatted_address]=Caf%C3%A9%20de%20Flore"
    );
  });

  it("keeps negative coordinates intact", () => {
    const url = getUberUrl("Sydney Opera House", {
      latitude: -33.8568,
      longitude: 151.2153,
    });
    expect(url).toContain("dropoff[latitude]=-33.8568");
    expect(url).toContain("dropoff[longitude]=151.2153");
  });

  it("omits the coordinate params entirely on the address path", () => {
    const url = getUberUrl("Central Park");
    expect(url).not.toContain("dropoff[latitude]");
    expect(url).not.toContain("dropoff[longitude]");
  });
});
