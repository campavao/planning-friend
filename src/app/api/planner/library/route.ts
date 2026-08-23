import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getContentWithTags, getFriends, getUserTags } from "@/lib/supabase";
import { getRecentQuickNotes } from "@/lib/db/planner";

// GET the week-independent planner data: the user's content library,
// tags, and shareable friends. Fetched once per session instead of
// being bundled into every per-week payload.
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const [allContent, allTags, friends, recentNotes] = await Promise.all([
      getContentWithTags(session.userId),
      getUserTags(session.userId),
      getFriends(session.userId),
      // Cheap, and rides along with the once-per-session library fetch rather
      // than costing the add-item modal a request of its own.
      getRecentQuickNotes(session.userId),
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
      recentNotes,
    });
  } catch (error) {
    console.error("Error getting planner library:", error);
    return NextResponse.json(
      { error: "Failed to get planner library" },
      { status: 500 },
    );
  }
}
