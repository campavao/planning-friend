import { NextRequest, NextResponse } from "next/server";
import {
  assignGiftToRecipient,
  addGiftNote,
  removeGiftAssignment,
  markGiftAsGiven,
  unmarkGiftAsGiven,
  getGiftIdeas,
  userOwnsGiftRecipient,
  userOwnsGiftAssignment,
  userOwnsContent,
} from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

// POST - Assign a gift to a recipient: a saved item (contentId) or a quick
// note (noteTitle)
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { recipientId, contentId, noteTitle } = await request.json();
    const trimmedNote = typeof noteTitle === "string" ? noteTitle.trim() : "";

    if (!recipientId || (!contentId && !trimmedNote)) {
      return NextResponse.json(
        { error: "recipientId and either contentId or noteTitle are required" },
        { status: 400 }
      );
    }

    // The recipient, and the gift content when there is one, must belong to
    // the caller.
    const [ownsRecipient, ownsContent] = await Promise.all([
      userOwnsGiftRecipient(recipientId, session.userId),
      contentId ? userOwnsContent(contentId, session.userId) : true,
    ]);
    if (!ownsRecipient || !ownsContent) {
      return forbidden();
    }

    const assignment = contentId
      ? await assignGiftToRecipient(recipientId, contentId)
      : await addGiftNote(recipientId, trimmedNote);
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
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id, given } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (!(await userOwnsGiftAssignment(id, session.userId))) {
      return forbidden();
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
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (!(await userOwnsGiftAssignment(id, session.userId))) {
      return forbidden();
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
