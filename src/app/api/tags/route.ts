import { NextRequest, NextResponse } from "next/server";
import {
  getUserTags,
  createTag,
  deleteTag,
  addTagToContent,
  removeTagFromContent,
  DEFAULT_TAGS,
} from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

// GET - List all tags for the user + default suggestions
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const userTags = await getUserTags(session.userId);
    const userTagNames = new Set(userTags.map((t) => t.name));

    // Suggest default tags that user doesn't have yet
    const suggestions = DEFAULT_TAGS.filter((t) => !userTagNames.has(t));

    return NextResponse.json({
      tags: userTags,
      suggestions,
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new tag or add tag to content
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { name, contentId, tagId } = await request.json();

    // If contentId and tagId provided, add existing tag to content
    if (contentId && tagId) {
      await addTagToContent(contentId, tagId);
      return NextResponse.json({ success: true });
    }

    // If name provided, create new tag (and optionally add to content)
    if (name) {
      const tag = await createTag(session.userId, name);

      if (contentId) {
        await addTagToContent(contentId, tag.id);
      }

      return NextResponse.json({ tag });
    }

    return NextResponse.json(
      { error: "Name or tagId required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tag or remove tag from content
export async function DELETE(request: NextRequest) {
  try {
    const { errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const tagId = request.nextUrl.searchParams.get("tagId");
    const contentId = request.nextUrl.searchParams.get("contentId");

    if (!tagId) {
      return NextResponse.json({ error: "tagId required" }, { status: 400 });
    }

    // If contentId provided, just remove from content
    if (contentId) {
      await removeTagFromContent(contentId, tagId);
      return NextResponse.json({ success: true });
    }

    // Otherwise delete the tag entirely
    await deleteTag(tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

