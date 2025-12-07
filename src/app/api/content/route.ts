import { NextRequest, NextResponse } from "next/server";
import {
  getContentByUser,
  getContentByCategory,
  type ContentCategory,
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

    // Check if session is expired
    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get session user
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get category filter from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ContentCategory | null;

    // Fetch content
    let content;
    if (
      category &&
      ["meal", "event", "date_idea", "other"].includes(category)
    ) {
      content = await getContentByCategory(session.userId, category);
    } else {
      content = await getContentByUser(session.userId);
    }

    return NextResponse.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
