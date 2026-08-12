import { NextRequest, NextResponse } from "next/server";
import {
  createItemNote,
  deleteItemNote,
  getItemNoteById,
  getItemNotes,
  updateItemNote,
  userOwnsContent,
  userOwnsItemNote,
  userOwnsPlanItem,
} from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import {
  createItemNoteBodySchema,
  updateItemNoteBodySchema,
} from "@/lib/schemas/item-notes";

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/**
 * Unlike GET /api/content/[id], which is public so items can be shared by
 * link, notes are private: they are the owner's opinion of the thing, not part
 * of the item. Every verb here requires a session and confirms ownership of
 * the content before touching a note.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    if (!(await userOwnsContent(id, session.userId))) {
      return forbidden();
    }

    const notes = await getItemNotes(id, session.userId);

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("Error fetching item notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    if (!(await userOwnsContent(id, session.userId))) {
      return forbidden();
    }

    const parsed = createItemNoteBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    // A note may name the occasion it came from, but only one of the caller's
    // own occasions.
    const { planItemId } = parsed.data;
    if (planItemId && !(await userOwnsPlanItem(planItemId, session.userId))) {
      return forbidden();
    }

    const note = await createItemNote({
      contentId: id,
      userId: session.userId,
      body: parsed.data.body,
      rating: parsed.data.rating,
      planItemId,
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Error creating item note:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const parsed = updateItemNoteBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    if (!(await userOwnsItemNote(parsed.data.id, session.userId))) {
      return forbidden();
    }

    // The note must actually belong to the item in the URL, so a valid note id
    // can't be edited through some other item's endpoint.
    const existing = await getItemNoteById(parsed.data.id);
    if (!existing || existing.content_id !== id) {
      return notFound();
    }

    const note = await updateItemNote(parsed.data.id, {
      body: parsed.data.body,
      rating: parsed.data.rating,
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Error updating item note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const noteId = request.nextUrl.searchParams.get("noteId");
    if (!noteId) {
      return NextResponse.json({ error: "noteId required" }, { status: 400 });
    }

    if (!(await userOwnsItemNote(noteId, session.userId))) {
      return forbidden();
    }

    const existing = await getItemNoteById(noteId);
    if (!existing || existing.content_id !== id) {
      return notFound();
    }

    await deleteItemNote(noteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
