import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getGiftRecipients,
  getRecipientsWithAssignments,
  createGiftRecipient,
  updateGiftRecipient,
  deleteGiftRecipient,
} from "@/lib/supabase";

// GET - List all recipients for the user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeAssignments = request.nextUrl.searchParams.get("include") === "assignments";

    if (includeAssignments) {
      const recipients = await getRecipientsWithAssignments(userId);
      return NextResponse.json({ recipients });
    }

    const recipients = await getGiftRecipients(userId);
    return NextResponse.json({ recipients });
  } catch (error) {
    console.error("Error fetching recipients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new recipient
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const recipient = await createGiftRecipient(userId, name.trim());
    return NextResponse.json({ recipient });
  } catch (error) {
    console.error("Error creating recipient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update a recipient
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name } = await request.json();

    if (!id || !name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "ID and name are required" },
        { status: 400 }
      );
    }

    const recipient = await updateGiftRecipient(id, name.trim());
    return NextResponse.json({ recipient });
  } catch (error) {
    console.error("Error updating recipient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a recipient
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

    await deleteGiftRecipient(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recipient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

