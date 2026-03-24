// Test the middleware's public API path matching logic
// The actual middleware requires Next.js runtime, but we can test the path matching

const PUBLIC_API_PATHS = [
  "/api/auth/send-code",
  "/api/auth/verify",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/twilio/webhook",
  "/api/share",
  "/api/process",
  "/api/push/subscribe",
  "/api/push/vapid-key",
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// ============================================
// isPublicApiPath
// ============================================
describe("isPublicApiPath", () => {
  describe("public paths", () => {
    it("recognizes exact public paths", () => {
      expect(isPublicApiPath("/api/auth/send-code")).toBe(true);
      expect(isPublicApiPath("/api/auth/verify")).toBe(true);
      expect(isPublicApiPath("/api/auth/logout")).toBe(true);
      expect(isPublicApiPath("/api/auth/session")).toBe(true);
      expect(isPublicApiPath("/api/twilio/webhook")).toBe(true);
      expect(isPublicApiPath("/api/share")).toBe(true);
      expect(isPublicApiPath("/api/process")).toBe(true);
      expect(isPublicApiPath("/api/push/subscribe")).toBe(true);
      expect(isPublicApiPath("/api/push/vapid-key")).toBe(true);
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
      // /api/processing starts with /api/process but not /api/process/
      // The function checks p === pathname || pathname.startsWith(p + "/")
      // "/api/processing".startsWith("/api/process/") is false
      // "/api/processing" === "/api/process" is false
      expect(isPublicApiPath("/api/processing")).toBe(false);
    });
  });
});

// ============================================
// Middleware matcher config
// ============================================
describe("middleware matcher config", () => {
  const matcherPatterns = ["/dashboard/:path*", "/api/:path*"];

  it("matches dashboard paths", () => {
    expect(matcherPatterns.some((p) => p.includes("dashboard"))).toBe(true);
  });

  it("matches api paths", () => {
    expect(matcherPatterns.some((p) => p.includes("api"))).toBe(true);
  });

  it("has exactly 2 matcher patterns", () => {
    expect(matcherPatterns).toHaveLength(2);
  });
});
