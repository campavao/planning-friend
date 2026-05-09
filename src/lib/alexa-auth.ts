import { NextRequest, NextResponse } from "next/server";

export interface AlexaContext {
  userId: string;
}

const BEARER_PREFIX = "Bearer ";

function getAlexaToken(): string | null {
  const token = process.env.ALEXA_API_TOKEN;
  if (!token || token.length < 24) return null;
  return token;
}

function getAlexaUserId(): string | null {
  const userId = process.env.ALEXA_USER_ID;
  if (!userId) return null;
  return userId;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Require a valid Alexa bearer token. Returns context and null response on success,
 * or null context and an error response on failure. Matches requireSession() shape.
 *
 * Single-user personal skill: token and target user id come from env vars.
 * Usage: const { context, errorResponse } = requireAlexaToken(request);
 *        if (errorResponse) return errorResponse;
 */
export function requireAlexaToken(
  request: NextRequest
):
  | { context: AlexaContext; errorResponse: null }
  | { context: null; errorResponse: NextResponse } {
  const expected = getAlexaToken();
  const userId = getAlexaUserId();
  if (!expected || !userId) {
    return {
      context: null,
      errorResponse: NextResponse.json(
        { error: "Alexa integration not configured" },
        { status: 503 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return {
      context: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const provided = authHeader.slice(BEARER_PREFIX.length);
  if (!timingSafeEqual(provided, expected)) {
    return {
      context: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { context: { userId }, errorResponse: null };
}
