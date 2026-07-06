import {
  getContentById,
  saveContent,
  updateContent,
  uploadThumbnailFromUrl,
} from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

// POST copy shared content into the caller's own collection.
// The copy is fully owned (and therefore editable) by the caller, while the
// original stays untouched and owned by its creator.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const original = await getContentById(id);

    if (!original) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (original.user_id === session.userId) {
      return NextResponse.json(
        { error: "This item is already in your collection" },
        { status: 400 }
      );
    }

    if (original.status !== "completed") {
      return NextResponse.json(
        { error: "This item is still processing and can't be copied yet" },
        { status: 400 }
      );
    }

    const copy = await saveContent({
      user_id: session.userId,
      tiktok_url: original.tiktok_url,
      category: original.category,
      title: original.title,
      data: original.data,
      thumbnail_url: original.thumbnail_url,
    });

    // Duplicate the thumbnail file under the copy's id so the copy keeps its
    // image even if the original owner deletes their item (which removes the
    // original's thumbnail from storage). Best-effort.
    if (original.thumbnail_url) {
      const copiedThumbnail = await uploadThumbnailFromUrl(
        original.thumbnail_url,
        copy.id
      );
      if (copiedThumbnail) {
        copy.thumbnail_url = copiedThumbnail;
        await updateContent(copy.id, { thumbnail_url: copiedThumbnail });
      }
    }

    return NextResponse.json({ success: true, content: copy });
  } catch (error) {
    console.error("Error copying content:", error);
    return NextResponse.json(
      { error: "Failed to copy content" },
      { status: 500 }
    );
  }
}
