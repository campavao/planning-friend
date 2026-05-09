import { NextRequest, NextResponse } from "next/server";
import {
  assignGiftToRecipient,
  removeGiftAssignment,
  markGiftAsGiven,
  unmarkGiftAsGiven,
  getGiftIdeas,
} from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

// GET - Get all gift ideas for the picker
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const giftIdeas = await getGiftIdeas(session.userId);
    return NextResponse.json({ giftIdeas });
  } catch (error) {
    console.error("Error fetching gift ideas:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Assign a gift to a recipient
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { recipientId, contentId } = await request.json();

    if (!recipientId || !contentId) {
      return NextResponse.json(
        { error: "recipientId and contentId are required" },
        { status: 400 }
      );
    }

    const assignment = await assignGiftToRecipient(recipientId, contentId);
    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Error assigning gift:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Mark/unmark a gift as given
export async function PATCH(request: NextRequest) {
  try {
    const { errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id, given } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (given) {
      await markGiftAsGiven(id);
    } else {
      await unmarkGiftAsGiven(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating gift status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a gift assignment
export async function DELETE(request: NextRequest) {
  try {
    const { errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await removeGiftAssignment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
