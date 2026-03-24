import {
  extractExifData,
  formatGpsCoordinates,
  getGoogleMapsUrl,
} from "@/lib/image-processing";
import type { ExifData } from "@/lib/image-processing";

// ============================================
// formatGpsCoordinates
// ============================================
describe("formatGpsCoordinates", () => {
  it("formats positive coordinates (northern/eastern hemisphere)", () => {
    const result = formatGpsCoordinates(40.7128, -74.006);
    expect(result).toContain("N");
    expect(result).toContain("W");
    expect(result).toContain("40.7128");
    expect(result).toContain("74.006");
  });

  it("formats southern hemisphere coordinates", () => {
    const result = formatGpsCoordinates(-33.8688, 151.2093);
    expect(result).toContain("S");
    expect(result).toContain("E");
  });

  it("formats exact zero coordinates", () => {
    const result = formatGpsCoordinates(0, 0);
    expect(result).toContain("N"); // 0 is >= 0, so N
    expect(result).toContain("E"); // 0 is >= 0, so E
  });

  it("formats coordinates to a readable string", () => {
    const result = formatGpsCoordinates(1.5, 2.5);
    expect(result).toContain("1.5");
    expect(result).toContain("2.5");
    expect(result).toContain("N");
    expect(result).toContain("E");
  });

  it("uses absolute values for display", () => {
    const result = formatGpsCoordinates(-45.123456, -90.654321);
    // Should show positive numbers with S/W directions
    expect(result).toMatch(/45\.123456.*S/);
    expect(result).toMatch(/90\.654321.*W/);
  });
});

// ============================================
// getGoogleMapsUrl
// ============================================
describe("getGoogleMapsUrl", () => {
  it("generates valid Google Maps URL", () => {
    const url = getGoogleMapsUrl(40.7128, -74.006);
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.7128,-74.006"
    );
  });

  it("handles negative coordinates", () => {
    const url = getGoogleMapsUrl(-33.8688, 151.2093);
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=-33.8688,151.2093"
    );
  });

  it("handles zero coordinates", () => {
    const url = getGoogleMapsUrl(0, 0);
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=0,0");
  });
});

// ============================================
// extractExifData
// ============================================
describe("extractExifData", () => {
  it("returns empty ExifData for non-JPEG images", () => {
    const buffer = Buffer.from("fake png data");
    const result = extractExifData(buffer, "image/png");
    expect(result).toEqual({});
  });

  it("returns empty ExifData for webp images", () => {
    const buffer = Buffer.from("fake webp data");
    const result = extractExifData(buffer, "image/webp");
    expect(result).toEqual({});
  });

  it("handles invalid JPEG buffer gracefully", () => {
    const buffer = Buffer.from("not a real jpeg");
    const result = extractExifData(buffer, "image/jpeg");
    // Should not throw, returns empty or partial data
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("handles image/jpg mime type the same as image/jpeg", () => {
    // Both should attempt EXIF extraction
    const buffer = Buffer.alloc(100); // Empty buffer
    const resultJpeg = extractExifData(buffer, "image/jpeg");
    const resultJpg = extractExifData(buffer, "image/jpg");
    // Both should attempt parsing (and likely return empty due to invalid data)
    expect(typeof resultJpeg).toBe("object");
    expect(typeof resultJpg).toBe("object");
  });
});

// ============================================
// ExifData type contract
// ============================================
describe("ExifData interface", () => {
  it("allows all optional fields", () => {
    const exif: ExifData = {};
    expect(exif.latitude).toBeUndefined();
    expect(exif.longitude).toBeUndefined();
    expect(exif.dateTaken).toBeUndefined();
    expect(exif.make).toBeUndefined();
    expect(exif.model).toBeUndefined();
    expect(exif.orientation).toBeUndefined();
  });

  it("allows setting GPS coordinates", () => {
    const exif: ExifData = {
      latitude: 40.7128,
      longitude: -74.006,
    };
    expect(exif.latitude).toBe(40.7128);
    expect(exif.longitude).toBe(-74.006);
  });

  it("allows setting device info", () => {
    const exif: ExifData = {
      make: "Apple",
      model: "iPhone 15 Pro",
      orientation: 1,
    };
    expect(exif.make).toBe("Apple");
    expect(exif.model).toBe("iPhone 15 Pro");
  });
});
