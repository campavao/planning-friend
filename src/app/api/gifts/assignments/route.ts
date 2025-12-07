import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  assignGiftToRecipient,
  removeGiftAssignment,
  getGiftIdeas,
} from "@/lib/supabase";

// GET - Get all gift ideas for the picker
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const giftIdeas = await getGiftIdeas(userId);
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
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

// DELETE - Remove a gift assignment
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
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

