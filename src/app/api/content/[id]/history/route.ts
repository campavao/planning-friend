import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { userOwnsContent } from "@/lib/supabase";
import { getPlanHistoryForContent } from "@/lib/db/planner";
import { summarisePlanHistory } from "@/lib/plan-history";

/**
 * When this item has been planned, and what that suggests.
 *
 * Private, unlike GET /api/content/[id], which is public so items can be shared
 * by link. When you cooked something is a fact about you rather than about the
 * recipe, and a shared link must not leak it.
 *
 * Kept off the main content payload deliberately: every item view would pay for
 * a second query to render a line that sits below the fold, so this is fetched
 * alongside rather than blocking the page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    if (!(await userOwnsContent(id, session.userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const plannedDates = await getPlanHistoryForContent(session.userId, id);

    return NextResponse.json({
      success: true,
      summary: summarisePlanHistory(plannedDates),
    });
  } catch (error) {
    console.error("Error getting plan history:", error);
    return NextResponse.json(
      { error: "Failed to get plan history" },
      { status: 500 }
    );
  }
}
