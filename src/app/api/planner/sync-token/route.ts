import { NextResponse } from "next/server";
import {
  getOrCreateCalendarSyncToken,
  regenerateCalendarSyncToken,
} from "@/lib/supabase";
import { cookies } from "next/headers";

interface SessionData {
  userId: string;
  phoneNumber: string;
  exp: number;
}

async function getSessionUser(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString()
    ) as SessionData;

    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// GET - Get or create sync token for the user
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokenData = await getOrCreateCalendarSyncToken(session.userId);

    return NextResponse.json({
      success: true,
      token: tokenData.token,
      createdAt: tokenData.created_at,
      lastAccessedAt: tokenData.last_accessed_at,
    });
  } catch (error) {
    console.error("Error getting sync token:", error);
    return NextResponse.json(
      { error: "Failed to get sync token" },
      { status: 500 }
    );
  }
}

// POST - Regenerate sync token (invalidates old one)
export async function POST() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokenData = await regenerateCalendarSyncToken(session.userId);

    return NextResponse.json({
      success: true,
      token: tokenData.token,
      createdAt: tokenData.created_at,
      message: "Sync token regenerated. Old sync URLs will no longer work.",
    });
  } catch (error) {
    console.error("Error regenerating sync token:", error);
    return NextResponse.json(
      { error: "Failed to regenerate sync token" },
      { status: 500 }
    );
  }
}
