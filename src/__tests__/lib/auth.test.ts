import {
  createSessionToken,
  getSessionFromCookieValue,
  getSessionFromRequest,
  SESSION_HEADERS,
} from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

// Set up a test secret
const TEST_SECRET = "test-session-secret-at-least-16-chars";

beforeAll(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.SESSION_SECRET;
});

// ============================================
// SESSION_HEADERS
// ============================================
describe("SESSION_HEADERS", () => {
  it("has the expected header names", () => {
    expect(SESSION_HEADERS.userId).toBe("x-session-user-id");
    expect(SESSION_HEADERS.phoneNumber).toBe("x-session-phone");
    expect(SESSION_HEADERS.exp).toBe("x-session-exp");
  });
});

// ============================================
// createSessionToken + getSessionFromCookieValue roundtrip
// ============================================
describe("session token creation and verification", () => {
  const testSession: SessionData = {
    userId: "user-123",
    phoneNumber: "+12125551234",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
  };

  it("creates a token that starts with v2.", async () => {
    const token = await createSessionToken(testSession);
    expect(token.startsWith("v2.")).toBe(true);
  });

  it("creates a token with sig.payload format", async () => {
    const token = await createSessionToken(testSession);
    const rest = token.slice(3); // Remove "v2."
    const parts = rest.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0); // signature
    expect(parts[1].length).toBeGreaterThan(0); // payload
  });

  it("roundtrips: created token can be verified", async () => {
    const token = await createSessionToken(testSession);
    const session = await getSessionFromCookieValue(token);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe(testSession.userId);
    expect(session!.phoneNumber).toBe(testSession.phoneNumber);
    expect(session!.exp).toBe(testSession.exp);
  });

  it("different sessions produce different tokens", async () => {
    const session2: SessionData = {
      ...testSession,
      userId: "user-456",
    };
    const token1 = await createSessionToken(testSession);
    const token2 = await createSessionToken(session2);
    expect(token1).not.toBe(token2);
  });
});

// ============================================
// getSessionFromCookieValue - invalid tokens
// ============================================
describe("getSessionFromCookieValue - invalid inputs", () => {
  it("returns null for empty string", async () => {
    expect(await getSessionFromCookieValue("")).toBeNull();
  });

  it("returns null for garbage data", async () => {
    expect(await getSessionFromCookieValue("not-a-token")).toBeNull();
  });

  it("returns null for v2 prefix without proper format", async () => {
    expect(await getSessionFromCookieValue("v2.nodotseparator")).toBeNull();
  });

  it("returns null for tampered payload", async () => {
    const session: SessionData = {
      userId: "user-123",
      phoneNumber: "+12125551234",
      exp: Date.now() + 100000,
    };
    const token = await createSessionToken(session);
    // Tamper with the payload by changing a character
    const parts = token.split(".");
    const tamperedPayload = parts[1] + "X";
    const tampered = parts[0] + "." + tamperedPayload;
    expect(await getSessionFromCookieValue(tampered)).toBeNull();
  });

  it("returns null for expired session", async () => {
    const expiredSession: SessionData = {
      userId: "user-123",
      phoneNumber: "+12125551234",
      exp: Date.now() - 1000, // Already expired
    };
    const token = await createSessionToken(expiredSession);
    expect(await getSessionFromCookieValue(token)).toBeNull();
  });
});

// ============================================
// getSessionFromCookieValue - legacy unsigned tokens
// ============================================
describe("getSessionFromCookieValue - legacy tokens", () => {
  it("accepts a valid legacy base64 token", async () => {
    const session: SessionData = {
      userId: "user-legacy",
      phoneNumber: "+15551234567",
      exp: Date.now() + 100000,
    };
    const legacyToken = Buffer.from(JSON.stringify(session)).toString("base64");
    const result = await getSessionFromCookieValue(legacyToken);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-legacy");
  });

  it("rejects expired legacy token", async () => {
    const session: SessionData = {
      userId: "user-legacy",
      phoneNumber: "+15551234567",
      exp: Date.now() - 1000,
    };
    const legacyToken = Buffer.from(JSON.stringify(session)).toString("base64");
    const result = await getSessionFromCookieValue(legacyToken);
    expect(result).toBeNull();
  });
});

// ============================================
// getSessionFromRequest
// ============================================
describe("getSessionFromRequest", () => {
  function createMockRequest(
    headers: Record<string, string>
  ): { headers: { get: (name: string) => string | null } } {
    return {
      headers: {
        get: (name: string) => headers[name] || null,
      },
    };
  }

  it("returns session when all headers are present and valid", () => {
    const futureExp = Date.now() + 100000;
    const request = createMockRequest({
      "x-session-user-id": "user-123",
      "x-session-phone": "+12125551234",
      "x-session-exp": String(futureExp),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = getSessionFromRequest(request as any);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("user-123");
    expect(session!.phoneNumber).toBe("+12125551234");
    expect(session!.exp).toBe(futureExp);
  });

  it("returns null when userId header is missing", () => {
    const request = createMockRequest({
      "x-session-phone": "+12125551234",
      "x-session-exp": String(Date.now() + 100000),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSessionFromRequest(request as any)).toBeNull();
  });

  it("returns null when phone header is missing", () => {
    const request = createMockRequest({
      "x-session-user-id": "user-123",
      "x-session-exp": String(Date.now() + 100000),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSessionFromRequest(request as any)).toBeNull();
  });

  it("returns null when exp header is missing", () => {
    const request = createMockRequest({
      "x-session-user-id": "user-123",
      "x-session-phone": "+12125551234",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSessionFromRequest(request as any)).toBeNull();
  });

  it("returns null when session is expired", () => {
    const request = createMockRequest({
      "x-session-user-id": "user-123",
      "x-session-phone": "+12125551234",
      "x-session-exp": String(Date.now() - 1000),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSessionFromRequest(request as any)).toBeNull();
  });

  it("returns null when exp is not a number", () => {
    const request = createMockRequest({
      "x-session-user-id": "user-123",
      "x-session-phone": "+12125551234",
      "x-session-exp": "not-a-number",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSessionFromRequest(request as any)).toBeNull();
  });
});

// ============================================
// createSessionToken - secret validation
// ============================================
describe("createSessionToken - secret validation", () => {
  it("throws when SESSION_SECRET is not set", async () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    const session: SessionData = {
      userId: "user-123",
      phoneNumber: "+12125551234",
      exp: Date.now() + 100000,
    };

    await expect(createSessionToken(session)).rejects.toThrow(
      "SESSION_SECRET must be set"
    );

    process.env.SESSION_SECRET = original;
  });

  it("throws when SESSION_SECRET is too short", async () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "short";

    const session: SessionData = {
      userId: "user-123",
      phoneNumber: "+12125551234",
      exp: Date.now() + 100000,
    };

    await expect(createSessionToken(session)).rejects.toThrow(
      "SESSION_SECRET must be set and at least 16 characters"
    );

    process.env.SESSION_SECRET = original;
  });
});
