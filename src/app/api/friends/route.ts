import { NextRequest, NextResponse } from "next/server";
import {
  getFriends,
  addFriend,
  updateFriend,
  deleteFriend,
  addFriendsFromContacts,
} from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

// GET - Get all friends (sorted: favorites first, then alphabetically)
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const friends = await getFriends(session.userId);

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Add friend (manual or from contacts)
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();

    // Check if this is a batch import from contacts
    if (body.contacts && Array.isArray(body.contacts)) {
      const contacts = body.contacts.map(
        (c: { name: string; phoneNumber?: string }) => ({
          name: c.name,
          phoneNumber: c.phoneNumber,
        })
      );

      const friends = await addFriendsFromContacts(session.userId, contacts);

      return NextResponse.json({
        success: true,
        friends,
        imported: friends.length,
      });
    }

    // Single friend add
    const { name, phoneNumber } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Name is too long (max 100 characters)" },
        { status: 400 }
      );
    }

    const friend = await addFriend(session.userId, name, phoneNumber);

    return NextResponse.json({ success: true, friend });
  } catch (error) {
    console.error("Error adding friend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update friend (name or favorite status)
export async function PATCH(request: NextRequest) {
  try {
    const { errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id, name, is_favorite } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Friend ID is required" },
        { status: 400 }
      );
    }

    const updates: { name?: string; is_favorite?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      if (name.trim().length > 100) {
        return NextResponse.json(
          { error: "Name is too long (max 100 characters)" },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (is_favorite !== undefined) {
      updates.is_favorite = Boolean(is_favorite);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const friend = await updateFriend(id, updates);

    return NextResponse.json({ success: true, friend });
  } catch (error) {
    console.error("Error updating friend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove friend
export async function DELETE(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Friend ID is required" },
        { status: 400 }
      );
    }

    await deleteFriend(id, session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting friend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
