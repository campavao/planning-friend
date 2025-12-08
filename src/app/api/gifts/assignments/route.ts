import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  assignGiftToRecipient,
  removeGiftAssignment,
  getGiftIdeas,
} from "@/lib/supabase";

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

    // Check if session is expired
    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// GET - Get all gift ideas for the picker
export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const session = await getSessionUser();

    if (!session) {
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
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
