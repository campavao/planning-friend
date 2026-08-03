import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Session state is never safe to reuse: a cached "authenticated" answer sends
// a signed-out user to /dashboard (where middleware bounces them back, a
// reload loop), and a cached "unauthenticated" one swallows a fresh login.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: session.userId,
          phoneNumber: session.phoneNumber,
        },
      },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
}
