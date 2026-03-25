/**
 * Tests for middleware path matching logic
 * Imports real exports — no duplicated logic
 */

import { PUBLIC_API_PATHS, isPublicApiPath, config } from "@/middleware";

// ============================================
// isPublicApiPath
// ============================================
describe("isPublicApiPath", () => {
  describe("public paths", () => {
    it("recognizes exact public paths", () => {
      for (const path of PUBLIC_API_PATHS) {
        expect(isPublicApiPath(path)).toBe(true);
      }
    });

    it("recognizes sub-paths of public paths", () => {
      expect(isPublicApiPath("/api/auth/send-code/retry")).toBe(true);
      expect(isPublicApiPath("/api/twilio/webhook/incoming")).toBe(true);
      expect(isPublicApiPath("/api/share/something")).toBe(true);
    });
  });

  describe("protected paths", () => {
    it("rejects content API paths", () => {
      expect(isPublicApiPath("/api/content")).toBe(false);
      expect(isPublicApiPath("/api/content/123")).toBe(false);
    });

    it("rejects planner API paths", () => {
      expect(isPublicApiPath("/api/planner")).toBe(false);
      expect(isPublicApiPath("/api/planner/item")).toBe(false);
    });

    it("rejects friends API paths", () => {
      expect(isPublicApiPath("/api/friends")).toBe(false);
    });

    it("rejects gifts API paths", () => {
      expect(isPublicApiPath("/api/gifts/recipients")).toBe(false);
    });

    it("rejects tags API paths", () => {
      expect(isPublicApiPath("/api/tags")).toBe(false);
    });

    it("rejects settings API path", () => {
      expect(isPublicApiPath("/api/settings")).toBe(false);
    });

    it("rejects users API path", () => {
      expect(isPublicApiPath("/api/users/name")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects root api path", () => {
      expect(isPublicApiPath("/api")).toBe(false);
    });

    it("rejects similar-looking paths", () => {
      // /api/shared is not the same as /api/share
      expect(isPublicApiPath("/api/shared")).toBe(false);
    });

    it("rejects /api/auth without specific endpoint", () => {
      expect(isPublicApiPath("/api/auth")).toBe(false);
    });

    it("does not match /api/processing (similar to /api/process)", () => {
      expect(isPublicApiPath("/api/processing")).toBe(false);
    });
  });
});

// ============================================
// Middleware matcher config
// ============================================
describe("middleware matcher config", () => {
  it("matches dashboard and api paths", () => {
    expect(config.matcher).toContain("/dashboard/:path*");
    expect(config.matcher).toContain("/api/:path*");
  });

  it("has exactly 2 matcher patterns", () => {
    expect(config.matcher).toHaveLength(2);
  });
});
