import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface SessionData {
  userId: string;
  phoneNumber: string;
  exp: number;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false });
    }

    const decoded = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString()
    ) as SessionData;

    // Check if session is expired
    if (decoded.exp < Date.now()) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: decoded.userId,
        phoneNumber: decoded.phoneNumber,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
