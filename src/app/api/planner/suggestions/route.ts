import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  getWeeklyPlanWithItems,
  getSharedItemsForUser,
  getWeekStart,
} from "@/lib/supabase";
import {
  getOrComputeSuggestions,
  type ThisWeekItemRef,
} from "@/lib/recommendations";
import { addDismissal } from "@/lib/db/suggestions";

async function buildThisWeekItems(
  userId: string,
  weekStart: string
): Promise<ThisWeekItemRef[]> {
  const plan = await getWeeklyPlanWithItems(userId, weekStart);
  let sharedItems: Awaited<ReturnType<typeof getSharedItemsForUser>> = [];
  try {
    sharedItems = await getSharedItemsForUser(userId, weekStart);
  } catch (err) {
    console.error("Failed to fetch shared items for suggestions:", err);
  }

  const items: ThisWeekItemRef[] = [];
  for (const item of plan?.items ?? []) {
    items.push({
      plannedDate: item.planned_date,
      contentId: item.content_id ?? null,
      category: item.content?.category ?? null,
      title: item.content?.title ?? item.note_title ?? null,
    });
  }
  for (const item of sharedItems) {
    items.push({
      plannedDate: item.planned_date,
      contentId: item.content_id ?? null,
      category: item.content?.category ?? null,
      title: item.content?.title ?? null,
    });
  }
  return items;
}

// POST: force-refresh suggestions. Body: { weekStart?, dayIndex? }
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const weekStart: string = body.weekStart || getWeekStart();
    const dayIndex: number | undefined =
      typeof body.dayIndex === "number" ? body.dayIndex : undefined;

    const featureEnabled =
      process.env.NEXT_PUBLIC_SMART_SUGGESTIONS_ENABLED === "true";

    if (!featureEnabled) {
      // A refresh that returns nothing because the flag is off used to look
      // exactly like a refresh that found nothing. Say which it is.
      console.log(
        "[suggestions] refresh skipped: NEXT_PUBLIC_SMART_SUGGESTIONS_ENABLED is not 'true'",
        JSON.stringify({ weekStart, dayIndex })
      );
      return NextResponse.json({
        success: true,
        suggestions: {},
        suggestionsMeta: {
          enabled: false,
          emptyPool: false,
          poolSize: 0,
          source: "disabled",
        },
      });
    }

    const thisWeekItems = await buildThisWeekItems(session.userId, weekStart);

    const result = await getOrComputeSuggestions({
      userId: session.userId,
      weekStart,
      thisWeekItems,
      force: true,
      onlyDayIndex: dayIndex,
      curatorEnabled: true,
    });

    return NextResponse.json({
      success: true,
      suggestions: result.payload,
      suggestionsMeta: {
        enabled: true,
        emptyPool: result.emptyPool,
        poolSize: result.poolSize,
        source: result.source,
      },
    });
  } catch (error) {
    console.error("Failed to refresh suggestions:", error);
    return NextResponse.json(
      { error: "Failed to refresh suggestions" },
      { status: 500 }
    );
  }
}

// DELETE: dismiss a single suggestion. Query: ?week=...&day=N&contentId=...
export async function DELETE(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week");
    const dayParam = searchParams.get("day");
    const contentId = searchParams.get("contentId");

    if (!weekStart || dayParam === null || !contentId) {
      return NextResponse.json(
        { error: "week, day, and contentId are required" },
        { status: 400 }
      );
    }

    const dayIndex = Number(dayParam);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      return NextResponse.json(
        { error: "day must be an integer 0-6" },
        { status: 400 }
      );
    }

    await addDismissal(session.userId, weekStart, dayIndex, contentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss suggestion:", error);
    return NextResponse.json(
      { error: "Failed to dismiss suggestion" },
      { status: 500 }
    );
  }
}
