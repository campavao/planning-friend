import { isGenericWebsiteUrl } from "@/lib/website";

// Note: extractTextContent, extractMetaTags, extractStructuredData, extractGoogleMapsPlaceName
// are not exported, so we test them indirectly through getWebsiteInfo or test the exported functions.

// ============================================
// isGenericWebsiteUrl
// ============================================
describe("isGenericWebsiteUrl", () => {
  describe("returns true for non-social-media URLs", () => {
    it("recognizes recipe websites", () => {
      expect(isGenericWebsiteUrl("https://www.allrecipes.com/recipe/123")).toBe(true);
    });

    it("recognizes news websites", () => {
      expect(isGenericWebsiteUrl("https://www.nytimes.com/article")).toBe(true);
    });

    it("recognizes Google Maps", () => {
      expect(isGenericWebsiteUrl("https://maps.google.com/place/123")).toBe(true);
    });

    it("recognizes random domains", () => {
      expect(isGenericWebsiteUrl("https://example.com/page")).toBe(true);
    });

    it("recognizes restaurant websites", () => {
      expect(isGenericWebsiteUrl("https://www.joes-pizza.com/menu")).toBe(true);
    });

    it("recognizes Yelp as generic website", () => {
      expect(isGenericWebsiteUrl("https://www.yelp.com/biz/some-restaurant")).toBe(
        true
      );
    });
  });

  describe("returns false for social media URLs", () => {
    it("rejects tiktok.com", () => {
      expect(isGenericWebsiteUrl("https://www.tiktok.com/@user/video/123")).toBe(
        false
      );
    });

    it("rejects vm.tiktok.com", () => {
      expect(isGenericWebsiteUrl("https://vm.tiktok.com/ZMabc/")).toBe(false);
    });

    it("rejects vt.tiktok.com", () => {
      expect(isGenericWebsiteUrl("https://vt.tiktok.com/ZSabc/")).toBe(false);
    });

    it("rejects instagram.com", () => {
      expect(isGenericWebsiteUrl("https://www.instagram.com/p/abc/")).toBe(false);
    });

    it("rejects instagr.am", () => {
      expect(isGenericWebsiteUrl("https://instagr.am/p/abc/")).toBe(false);
    });

    it("rejects facebook.com", () => {
      expect(isGenericWebsiteUrl("https://www.facebook.com/page")).toBe(false);
    });

    it("rejects twitter.com", () => {
      expect(isGenericWebsiteUrl("https://twitter.com/user/status/123")).toBe(false);
    });

    it("rejects x.com", () => {
      expect(isGenericWebsiteUrl("https://x.com/user/status/123")).toBe(false);
    });

    it("rejects youtube.com", () => {
      expect(isGenericWebsiteUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
    });

    it("rejects youtu.be", () => {
      expect(isGenericWebsiteUrl("https://youtu.be/abc")).toBe(false);
    });

    it("rejects fb.com", () => {
      expect(isGenericWebsiteUrl("https://fb.com/page")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for invalid URL", () => {
      expect(isGenericWebsiteUrl("not-a-url")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isGenericWebsiteUrl("")).toBe(false);
    });

    it("handles subdomains of social media correctly", () => {
      // www.tiktok.com should be rejected (subdomain of tiktok.com)
      expect(isGenericWebsiteUrl("https://www.tiktok.com")).toBe(false);
    });
  });
});
