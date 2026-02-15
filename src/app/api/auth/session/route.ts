import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        phoneNumber: session.phoneNumber,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
