import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUserName } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

// GET - Check if user has name set
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasName: !!user.name,
      name: user.name || null,
    });
  } catch (error) {
    console.error("Error fetching user name:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Set/update user name
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Name is too long (max 100 characters)" },
        { status: 400 }
      );
    }

    const user = await updateUserName(session.userId, name);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Error updating user name:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
