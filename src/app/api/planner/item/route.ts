import { NextRequest, NextResponse } from "next/server";
import { removePlanItem } from "@/lib/supabase";
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
      return NextResponse.json(
        { error: "Missing item ID" },
        { status: 400 }
      );
    }

    await removePlanItem(itemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing plan item:", error);
    return NextResponse.json(
      { error: "Failed to remove item" },
      { status: 500 }
    );
  }
}

