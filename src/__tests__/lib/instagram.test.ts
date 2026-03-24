import { isInstagramUrl, extractInstagramMediaId } from "@/lib/instagram";

// ============================================
// isInstagramUrl
// ============================================
describe("isInstagramUrl", () => {
  it("recognizes standard instagram.com URL", () => {
    expect(isInstagramUrl("https://www.instagram.com/p/abc123/")).toBe(true);
  });

  it("recognizes instagram.com reel URL", () => {
    expect(isInstagramUrl("https://www.instagram.com/reel/abc123/")).toBe(true);
  });

  it("recognizes instagr.am short URL", () => {
    expect(isInstagramUrl("https://instagr.am/abc123/")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isInstagramUrl("https://WWW.INSTAGRAM.COM/p/abc/")).toBe(true);
  });

  it("recognizes Instagram URL without www", () => {
    expect(isInstagramUrl("https://instagram.com/p/abc123/")).toBe(true);
  });

  it("rejects non-Instagram URLs", () => {
    expect(isInstagramUrl("https://www.tiktok.com/@user/video/123")).toBe(false);
    expect(isInstagramUrl("https://example.com")).toBe(false);
    expect(isInstagramUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("matches URLs that contain instagram.com as substring of another domain", () => {
    // The regex /instagram\.com/i matches anywhere in the string, including subdomains
    // This is the current behavior - notinstagram.com contains "instagram.com"
    expect(isInstagramUrl("https://notinstagram.com/p/abc/")).toBe(true);
  });
});

// ============================================
// extractInstagramMediaId
// ============================================
describe("extractInstagramMediaId", () => {
  it("extracts media ID from post URL", () => {
    expect(extractInstagramMediaId("https://www.instagram.com/p/CaBC123def/")).toBe(
      "CaBC123def"
    );
  });

  it("extracts media ID from reel URL", () => {
    expect(
      extractInstagramMediaId("https://www.instagram.com/reel/CaBC123def/")
    ).toBe("CaBC123def");
  });

  it("extracts media ID from reels URL", () => {
    expect(
      extractInstagramMediaId("https://www.instagram.com/reels/CaBC123def/")
    ).toBe("CaBC123def");
  });

  it("handles URL without trailing slash", () => {
    expect(
      extractInstagramMediaId("https://www.instagram.com/p/CaBC123def")
    ).toBe("CaBC123def");
  });

  it("handles media ID with hyphens and underscores", () => {
    expect(
      extractInstagramMediaId("https://www.instagram.com/p/Ca-BC_123/")
    ).toBe("Ca-BC_123");
  });

  it("returns null for profile URL", () => {
    expect(
      extractInstagramMediaId("https://www.instagram.com/username/")
    ).toBeNull();
  });

  it("extracts ID from any URL with /p/ path (not Instagram-specific)", () => {
    // extractInstagramMediaId only looks for /p/, /reel/, /reels/ patterns - it doesn't check domain
    expect(extractInstagramMediaId("https://example.com/p/abc/")).toBe("abc");
  });

  it("returns null for Instagram URL without media path", () => {
    expect(extractInstagramMediaId("https://www.instagram.com/")).toBeNull();
  });
});
