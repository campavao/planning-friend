/**
 * Tests for TikTok utility functions
 * Imports real exports — no duplicated logic
 */

import {
  extractVideoId,
  decodeHTMLEntities,
  isShortUrl,
} from "@/lib/tiktok";

// ============================================
// extractVideoId
// ============================================
describe("extractVideoId", () => {
  it("extracts video ID from standard URL", () => {
    expect(
      extractVideoId("https://www.tiktok.com/@user/video/7123456789012345678")
    ).toBe("7123456789012345678");
  });

  it("extracts video ID from URL with query params", () => {
    expect(
      extractVideoId(
        "https://www.tiktok.com/@user/video/7123456789012345678?is_copy_url=1"
      )
    ).toBe("7123456789012345678");
  });

  it("returns null for short URLs without video ID", () => {
    expect(extractVideoId("https://vm.tiktok.com/ZMabc123/")).toBeNull();
  });

  it("returns null for non-TikTok URLs", () => {
    expect(extractVideoId("https://example.com/page")).toBeNull();
  });
});

// ============================================
// decodeHTMLEntities
// ============================================
describe("decodeHTMLEntities", () => {
  it("decodes &amp; to &", () => {
    expect(decodeHTMLEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodes &lt; and &gt;", () => {
    expect(decodeHTMLEntities("&lt;div&gt;")).toBe("<div>");
  });

  it("decodes &quot;", () => {
    expect(decodeHTMLEntities("He said &quot;hello&quot;")).toBe(
      'He said "hello"'
    );
  });

  it("decodes &#39; and &#x27; (single quotes)", () => {
    expect(decodeHTMLEntities("it&#39;s")).toBe("it's");
    expect(decodeHTMLEntities("it&#x27;s")).toBe("it's");
  });

  it("decodes &#x2F; (forward slash)", () => {
    expect(decodeHTMLEntities("path&#x2F;to&#x2F;file")).toBe("path/to/file");
  });

  it("handles text with no entities", () => {
    expect(decodeHTMLEntities("plain text")).toBe("plain text");
  });

  it("handles multiple entities in one string", () => {
    expect(decodeHTMLEntities("a &amp; b &lt; c &gt; d")).toBe("a & b < c > d");
  });
});

// ============================================
// isShortUrl
// ============================================
describe("isShortUrl", () => {
  it("detects vm.tiktok.com as short URL", () => {
    expect(isShortUrl("https://vm.tiktok.com/ZMabc123/")).toBe(true);
  });

  it("detects vt.tiktok.com as short URL", () => {
    expect(isShortUrl("https://vt.tiktok.com/ZSabc123/")).toBe(true);
  });

  it("detects /t/ path as short URL", () => {
    expect(isShortUrl("https://www.tiktok.com/t/ZMabc123/")).toBe(true);
  });

  it("does not flag standard video URLs as short", () => {
    expect(isShortUrl("https://www.tiktok.com/@user/video/123")).toBe(false);
  });
});
