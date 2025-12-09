import {
  deleteContent,
  deleteThumbnail,
  getContentById,
  getContentTags,
  updateContent,
} from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

// GET single content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const content = await getContentById(id);

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify ownership
    if (content.user_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch tags for this content
    let tags: Awaited<ReturnType<typeof getContentTags>> = [];
    try {
      tags = await getContentTags(id);
    } catch {
      // Tags table might not exist yet, continue without tags
    }

    return NextResponse.json({ success: true, content, tags });
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
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const { title, category, data } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (data !== undefined) updates.data = data;

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
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
