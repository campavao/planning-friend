import { NextRequest, NextResponse } from "next/server";
import { getUserSettings, upsertUserSettings } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

// GET - Get user settings
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const settings = await getUserSettings(session.userId);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Update user settings
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { home_region, home_country } = await request.json();

    const settings = await upsertUserSettings(session.userId, {
      home_region,
      home_country,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

