import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_EXPIRATION_MS } from "@/lib/constants";

export interface SessionData {
  userId: string;
  phoneNumber: string;
  exp: number;
}

const SESSION_HEADER_USER_ID = "x-session-user-id";
const SESSION_HEADER_PHONE = "x-session-phone";
const SESSION_HEADER_EXP = "x-session-exp";
const SESSION_PREFIX = "v2.";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET must be set and at least 16 characters (use a random string for production)"
    );
  }
  return secret;
}

async function hmacSign(message: string): Promise<ArrayBuffer> {
  const secret = getSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
}

async function hmacVerify(message: string, signature: ArrayBuffer): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(message)
  );
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create a signed session token. Call from auth/verify route only.
 * Requires SESSION_SECRET env var (min 16 chars).
 */
export async function createSessionToken(session: SessionData): Promise<string> {
  const payload = JSON.stringify({
    userId: session.userId,
    phoneNumber: session.phoneNumber,
    exp: session.exp,
  });
  const signature = await hmacSign(payload);
  const sigB64 = base64UrlEncode(signature);
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadB64 = base64UrlEncode(payloadBytes);
  return SESSION_PREFIX + sigB64 + "." + payloadB64;
}

/**
 * Parse and verify session from raw cookie value. Edge-safe.
 * Supports signed (v2.sig.payload) and legacy unsigned base64 for backward compatibility.
 */
export async function getSessionFromCookieValue(
  cookieValue: string
): Promise<SessionData | null> {
  try {
    if (cookieValue.startsWith(SESSION_PREFIX)) {
      const rest = cookieValue.slice(SESSION_PREFIX.length);
      const dot = rest.indexOf(".");
      if (dot === -1) return null;
      const sigB64 = rest.slice(0, dot);
      const payloadB64 = rest.slice(dot + 1);
      const sigBytes = base64UrlDecode(sigB64);
      const signature = sigBytes.buffer.slice(
        sigBytes.byteOffset,
        sigBytes.byteOffset + sigBytes.byteLength
      ) as ArrayBuffer;
      const payloadBytes = base64UrlDecode(payloadB64);
      const payloadStr = new TextDecoder().decode(payloadBytes);
      const valid = await hmacVerify(payloadStr, signature);
      if (!valid) return null;
      const parsed = JSON.parse(payloadStr) as SessionData;
      if (parsed.exp < Date.now()) return null;
      return parsed;
    }
    // Legacy unsigned cookie (backward compat)
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(cookieValue, "base64").toString()
        : atob(cookieValue.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(decoded) as SessionData;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Get session from request (reads headers set by middleware if present).
 */
export function getSessionFromRequest(request: NextRequest): SessionData | null {
  const userId = request.headers.get(SESSION_HEADER_USER_ID);
  const phoneNumber = request.headers.get(SESSION_HEADER_PHONE);
  const exp = request.headers.get(SESSION_HEADER_EXP);
  if (!userId || !phoneNumber || !exp) return null;
  const expNum = parseInt(exp, 10);
  if (Number.isNaN(expNum) || expNum < Date.now()) return null;
  return { userId, phoneNumber, exp: expNum };
}

/**
 * Get session from cookies(). Use in route handlers.
 */
export async function getSessionUser(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;
  return await getSessionFromCookieValue(sessionCookie.value);
}

/**
 * Get session, preferring request headers (from middleware) then cookies.
 * Use in protected route handlers.
 */
export async function getSession(
  request?: NextRequest
): Promise<SessionData | null> {
  if (request) {
    const fromHeaders = getSessionFromRequest(request);
    if (fromHeaders) return fromHeaders;
  }
  return getSessionUser();
}

/**
 * Require a valid session. Returns session and null response, or null session and 401 response.
 * Usage: const { session, errorResponse } = await requireSession(request);
 *        if (errorResponse) return errorResponse;
 */
export async function requireSession(
  request?: NextRequest
): Promise<
  | { session: SessionData; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const session = await getSession(request);
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, errorResponse: null };
}

/** Header names used by middleware to pass session to route handlers */
export const SESSION_HEADERS = {
  userId: SESSION_HEADER_USER_ID,
  phoneNumber: SESSION_HEADER_PHONE,
  exp: SESSION_HEADER_EXP,
} as const;
