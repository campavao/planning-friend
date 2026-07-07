import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { searchPlanItems } from "@/lib/supabase";

// GET search the user's planned items (notes + scheduled content) by title
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (query.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const results = await searchPlanItems(session.userId, query, 20);

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Error searching plan items:", error);
    return NextResponse.json(
      { error: "Failed to search plan items" },
      { status: 500 },
    );
  }
}
