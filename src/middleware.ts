import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieValue, SESSION_HEADERS } from "@/lib/auth";

export const PUBLIC_API_PATHS = [
  "/api/auth/send-code",
  "/api/auth/verify",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/twilio/webhook",
  "/api/share",
  "/api/process",
  // Geocode-and-redirect helper for the Uber CTA. Stateless, reads nothing —
  // and content detail pages are publicly viewable, so a shared item's
  // location CTA has to work without a session.
  "/api/uber",
  "/api/push/subscribe",
  "/api/push/vapid-key",
  "/api/alexa",
];

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Content detail pages (/dashboard/<uuid>) are publicly viewable so extracted
// content can be shared by link. Editing is still enforced server-side by the
// content API's ownership checks.
const CONTENT_DETAIL_PATH =
  /^\/dashboard\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isPublicContentPath(pathname: string): boolean {
  return CONTENT_DETAIL_PATH.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dashboard: redirect to login if no valid session
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get("session");
    const session = sessionCookie
      ? await getSessionFromCookieValue(sessionCookie.value)
      : null;
    if (!session) {
      if (isPublicContentPath(pathname)) {
        return NextResponse.next();
      }
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }
    // Pass session to route via headers so handlers don't re-parse
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(SESSION_HEADERS.userId, session.userId);
    requestHeaders.set(SESSION_HEADERS.phoneNumber, session.phoneNumber);
    requestHeaders.set(SESSION_HEADERS.exp, String(session.exp));
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Protected API routes: set session headers if valid (routes still enforce 401)
  if (pathname.startsWith("/api/") && !isPublicApiPath(pathname)) {
    const sessionCookie = request.cookies.get("session");
    const session = sessionCookie
      ? await getSessionFromCookieValue(sessionCookie.value)
      : null;
    if (session) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(SESSION_HEADERS.userId, session.userId);
      requestHeaders.set(SESSION_HEADERS.phoneNumber, session.phoneNumber);
      requestHeaders.set(SESSION_HEADERS.exp, String(session.exp));
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
