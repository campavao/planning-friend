import { NextRequest, NextResponse } from "next/server";
import { removePlanItem, updatePlanItem } from "@/lib/supabase";
import { cookies } from "next/headers";

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
      Buffer.from(sessionCookie.value, "base64").toString(),
    ) as SessionData;

    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// DELETE remove item from plan
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }

    await removePlanItem(itemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing plan item:", error);
    return NextResponse.json(
      { error: "Failed to remove item" },
      { status: 500 },
    );
  }
}

// PUT update item in plan
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, contentId, noteTitle, notes, plannedDate } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }
    if (!plannedDate) {
      return NextResponse.json(
        { error: "plannedDate is required" },
        { status: 400 },
      );
    }
    if (!contentId && !noteTitle) {
      return NextResponse.json(
        { error: "Either contentId or noteTitle is required" },
        { status: 400 },
      );
    }

    const updates = contentId
      ? {
          contentId,
          noteTitle: null,
          notes: notes ?? null,
          plannedDate,
        }
      : {
          contentId: null,
          noteTitle,
          notes: notes ?? null,
          plannedDate,
        };

    const item = await updatePlanItem(id, updates);

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Error updating plan item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 },
    );
  }
}
