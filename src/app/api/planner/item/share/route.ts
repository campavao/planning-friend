import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  shareItemWithFriends,
  updateItemSharing,
  leaveSharedItem,
  getItemShareInfo,
  getFriends,
} from "@/lib/supabase";

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

// GET - Get share info for a plan item
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    const shareInfo = await getItemShareInfo(itemId);

    // Also get the user's friends with linked accounts to show who CAN be shared with
    const friends = await getFriends(session.userId);
    const shareableFriends = friends.filter((f) => f.linked_user_id);

    return NextResponse.json({
      shareInfo,
      shareableFriends: shareableFriends.map((f) => ({
        id: f.id,
        name: f.name,
        linkedUserId: f.linked_user_id,
        isFavorite: f.is_favorite,
      })),
    });
  } catch (error) {
    console.error("Error getting item share info:", error);
    return NextResponse.json(
      { error: "Failed to get share info" },
      { status: 500 }
    );
  }
}

// POST - Share a plan item with friends
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId, friendIds } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    if (!friendIds || !Array.isArray(friendIds)) {
      return NextResponse.json(
        { error: "friendIds array is required" },
        { status: 400 }
      );
    }

    // Get the friends to find their linked_user_ids
    const friends = await getFriends(session.userId);
    const friendMap = new Map(friends.map((f) => [f.id, f]));

    // Convert friend IDs to linked user IDs (only friends with linked accounts can receive shares)
    const linkedUserIds: string[] = [];
    for (const friendId of friendIds) {
      const friend = friendMap.get(friendId);
      if (friend?.linked_user_id) {
        linkedUserIds.push(friend.linked_user_id);
      }
    }

    if (linkedUserIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of the selected friends have linked accounts. They need to sign up for Planning Friend first.",
        },
        { status: 400 }
      );
    }

    await shareItemWithFriends(itemId, session.userId, linkedUserIds);

    return NextResponse.json({
      success: true,
      sharedWith: linkedUserIds.length,
    });
  } catch (error) {
    console.error("Error sharing plan item:", error);
    return NextResponse.json(
      { error: "Failed to share item" },
      { status: 500 }
    );
  }
}

// PUT - Update sharing (set exact list of people to share with)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId, friendIds } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(friendIds)) {
      return NextResponse.json(
        { error: "friendIds array is required" },
        { status: 400 }
      );
    }

    // Get the friends to find their linked_user_ids
    const friends = await getFriends(session.userId);
    const friendMap = new Map(friends.map((f) => [f.id, f]));

    // Convert friend IDs to linked user IDs
    const linkedUserIds: string[] = [];
    for (const friendId of friendIds) {
      const friend = friendMap.get(friendId);
      if (friend?.linked_user_id) {
        linkedUserIds.push(friend.linked_user_id);
      }
    }

    await updateItemSharing(itemId, session.userId, linkedUserIds);

    return NextResponse.json({
      success: true,
      sharedWith: linkedUserIds.length,
    });
  } catch (error) {
    console.error("Error updating plan item sharing:", error);
    return NextResponse.json(
      { error: "Failed to update sharing" },
      { status: 500 }
    );
  }
}

// DELETE - Leave a shared item (remove yourself from the share)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    await leaveSharedItem(itemId, session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving shared item:", error);
    return NextResponse.json(
      { error: "Failed to leave shared item" },
      { status: 500 }
    );
  }
}
