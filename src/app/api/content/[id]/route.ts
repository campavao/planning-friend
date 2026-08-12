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
import {
  applyContentDataPatch,
  MANUAL_EDIT_STAMP_KEY,
  updateContentBodySchema,
} from "@/lib/schemas/content";

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const parsed = updateContentBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { title, category, data, is_favorite } = parsed.data;

    const updates: Parameters<typeof updateContent>[1] = {};
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (is_favorite !== undefined) updates.is_favorite = is_favorite;

    // An empty patch is a save with nothing in it — leave `data` out of the
    // update entirely rather than rewriting the column with itself.
    if (data !== undefined && Object.keys(data).length > 0) {
      // Validated against the category the item is *becoming*: when the same
      // save fixes a mis-classification and the details in one go, the details
      // belong to the new shape.
      //
      // What does not happen here: the stored blob is not wiped or filtered
      // when the category changes. Re-categorising is how a user corrects our
      // mistake — a drink filed as a meal — and the extracted fields are mostly
      // still right (ingredients/recipe mean the same thing in both; so do
      // location and description across event/date/travel). Dropping the keys
      // the new view happens not to render would punish exactly the user who is
      // fixing our error, and the change would be irreversible. Instead the
      // keys stay, inert, and reappear if the category is switched back.
      const patched = applyContentDataPatch(
        category ?? content.category,
        content.data,
        data
      );

      if (!patched.success) {
        return NextResponse.json({ error: patched.error }, { status: 400 });
      }

      // Marks the blob as hand-edited so the detail page can warn that a
      // re-process throws the edit away. Re-processing rewrites `data` whole,
      // which clears the mark on its own.
      updates.data = {
        ...patched.data,
        [MANUAL_EDIT_STAMP_KEY]: new Date().toISOString(),
      };
    }

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
