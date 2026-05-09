import {
  detectPlatform,
  isTikTokUrl,
  extractSocialMediaUrl,
  getPlatformDisplayName,
} from "@/lib/social-media";

// ============================================
// isTikTokUrl
// ============================================
describe("isTikTokUrl", () => {
  it("recognizes standard tiktok.com URL", () => {
    expect(isTikTokUrl("https://www.tiktok.com/@user/video/123")).toBe(true);
  });

  it("recognizes vm.tiktok.com short URL", () => {
    expect(isTikTokUrl("https://vm.tiktok.com/ZMabc123/")).toBe(true);
  });

  it("recognizes vt.tiktok.com short URL", () => {
    expect(isTikTokUrl("https://vt.tiktok.com/ZSabc123/")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isTikTokUrl("https://WWW.TIKTOK.COM/@user/video/123")).toBe(true);
  });

  it("rejects non-TikTok URLs", () => {
    expect(isTikTokUrl("https://www.instagram.com/p/abc123/")).toBe(false);
    expect(isTikTokUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
    expect(isTikTokUrl("https://example.com")).toBe(false);
  });
});

// ============================================
// detectPlatform
// ============================================
describe("detectPlatform", () => {
  it("detects TikTok URLs", () => {
    expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
    expect(detectPlatform("https://vm.tiktok.com/ZMabc/")).toBe("tiktok");
  });

  it("detects Instagram URLs", () => {
    expect(detectPlatform("https://www.instagram.com/reel/abc123/")).toBe("instagram");
    expect(detectPlatform("https://www.instagram.com/p/abc123/")).toBe("instagram");
    expect(detectPlatform("https://instagr.am/p/abc123/")).toBe("instagram");
  });

  it("detects generic website URLs", () => {
    expect(detectPlatform("https://www.allrecipes.com/recipe/123")).toBe("website");
    expect(detectPlatform("https://www.nytimes.com/article")).toBe("website");
  });

  it("returns unknown for social platforms without handlers", () => {
    // These are in the social media block list in website.ts
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("unknown");
    expect(detectPlatform("https://twitter.com/user/status/123")).toBe("unknown");
    expect(detectPlatform("https://x.com/user/status/123")).toBe("unknown");
  });
});

// ============================================
// extractSocialMediaUrl
// ============================================
describe("extractSocialMediaUrl", () => {
  describe("TikTok URLs", () => {
    it("extracts standard TikTok video URL from text", () => {
      const text = "Check out this video https://www.tiktok.com/@user/video/1234567890 it's great!";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("tiktok");
      expect(result!.url).toBe("https://www.tiktok.com/@user/video/1234567890");
    });

    it("extracts short TikTok URL (vm.tiktok.com)", () => {
      const text = "https://vm.tiktok.com/ZMabc123 check this";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("tiktok");
    });

    it("extracts short TikTok URL (vt.tiktok.com)", () => {
      const text = "Look at https://vt.tiktok.com/ZSabc123 please";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("tiktok");
    });

    it("extracts /t/ short TikTok URL", () => {
      const text = "https://www.tiktok.com/t/ZMabc123";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("tiktok");
    });
  });

  describe("Instagram URLs", () => {
    it("extracts Instagram reel URL", () => {
      const text = "Check this reel https://www.instagram.com/reel/Cabc123def/";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("instagram");
    });

    it("extracts Instagram post URL", () => {
      const text = "https://www.instagram.com/p/Cabc123def/ nice post";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("instagram");
    });

    it("extracts Instagram story URL", () => {
      const text = "https://www.instagram.com/stories/username/1234567890/";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("instagram");
    });
  });

  describe("no match", () => {
    it("returns null for plain text without URLs", () => {
      expect(extractSocialMediaUrl("just some text")).toBeNull();
    });

    it("returns null for non-social-media URLs", () => {
      expect(extractSocialMediaUrl("https://example.com/page")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractSocialMediaUrl("")).toBeNull();
    });
  });

  describe("priority", () => {
    it("prefers TikTok over Instagram when both present", () => {
      const text =
        "https://www.tiktok.com/@user/video/123 and https://www.instagram.com/p/abc/";
      const result = extractSocialMediaUrl(text);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("tiktok");
    });
  });
});

// ============================================
// getPlatformDisplayName
// ============================================
describe("getPlatformDisplayName", () => {
  it("returns TikTok for tiktok", () => {
    expect(getPlatformDisplayName("tiktok")).toBe("TikTok");
  });

  it("returns Instagram for instagram", () => {
    expect(getPlatformDisplayName("instagram")).toBe("Instagram");
  });

  it("returns Website for website", () => {
    expect(getPlatformDisplayName("website")).toBe("Website");
  });

  it("returns Content for unknown", () => {
    expect(getPlatformDisplayName("unknown")).toBe("Content");
  });
});
