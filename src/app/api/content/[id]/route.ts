import {
  deleteContent,
  deleteThumbnail,
  getContentById,
  getContentTags,
  getUserById,
  updateContent,
} from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getSession, requireSession } from "@/lib/auth";

// GET single content — public so extracted content can be shared by link.
// Editing (PATCH/DELETE) remains owner-only below.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Session is optional here: viewers without an account can still read
    const session = await getSession(request);

    const { id } = await params;
    const content = await getContentById(id);

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = session?.userId === content.user_id;

    // Fetch tags for this content
    let tags: Awaited<ReturnType<typeof getContentTags>> = [];
    try {
      tags = await getContentTags(id);
    } catch {
      // Tags table might not exist yet, continue without tags
    }

    // Include the owner's display name so shared views can attribute the item
    let ownerName: string | null = null;
    if (!isOwner) {
      try {
        const owner = await getUserById(content.user_id);
        ownerName = owner?.name || null;
      } catch {
        // Attribution is best-effort
      }
    }

    return NextResponse.json({ success: true, content, tags, isOwner, ownerName });
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

// PATCH update content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const content = await getContentById(id);

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify ownership
    if (content.user_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, category, data, is_favorite } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (data !== undefined) updates.data = data;
    // Starring is a flag and only a flag — a non-boolean is dropped rather
    // than written through, so the column can't pick up a "true" string.
    if (typeof is_favorite === "boolean") updates.is_favorite = is_favorite;

    const updatedContent = await updateContent(id, updates);

    return NextResponse.json({ success: true, content: updatedContent });
  } catch (error) {
    console.error("Error updating content:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
      { status: 500 }
    );
  }
}

// DELETE content
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const content = await getContentById(id);

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify ownership
    if (content.user_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteContent(id, session.userId);

    // Clean up the thumbnail from storage
    await deleteThumbnail(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting content:", error);
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 }
    );
  }
}
