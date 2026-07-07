import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getContentWithTags, getFriends, getUserTags } from "@/lib/supabase";

// GET the week-independent planner data: the user's content library,
// tags, and shareable friends. Fetched once per session instead of
// being bundled into every per-week payload.
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const [allContent, allTags, friends] = await Promise.all([
      getContentWithTags(session.userId),
      getUserTags(session.userId),
      getFriends(session.userId),
    ]);

    const availableContent = allContent.filter(
      (c) => c.status === "completed",
    );

    const shareableFriends = friends
      .filter((f) => f.linked_user_id)
      .map((f) => ({
        id: f.id,
        name: f.name,
        linkedUserId: f.linked_user_id,
        isFavorite: f.is_favorite,
      }));

    return NextResponse.json({
      success: true,
      availableContent,
      allTags,
      shareableFriends,
    });
  } catch (error) {
    console.error("Error getting planner library:", error);
    return NextResponse.json(
      { error: "Failed to get planner library" },
      { status: 500 },
    );
  }
}
