import { NextRequest, NextResponse } from "next/server";
import {
  getContentByUser,
  getContentByCategory,
  getContentWithTags,
  getUserTags,
  type ContentCategory,
} from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    // Get category filter from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ContentCategory | null;
    const includeTags = searchParams.get("includeTags") === "true";

    // Fetch content (with or without tags)
    let content;
    if (includeTags) {
      // Get content with tags included
      content = await getContentWithTags(session.userId);
    } else if (
      category &&
      [
        "meal",
        "drink",
        "event",
        "date_idea",
        "gift_idea",
        "travel",
        "other",
      ].includes(category)
    ) {
      content = await getContentByCategory(session.userId, category);
    } else {
      content = await getContentByUser(session.userId);
    }

    // Get user's tags for filtering UI
    let tags: Awaited<ReturnType<typeof getUserTags>> = [];
    if (includeTags) {
      try {
        tags = await getUserTags(session.userId);
      } catch {
        // Tags table might not exist yet, continue without tags
      }
    }

    return NextResponse.json({
      success: true,
      content,
      tags,
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
