import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  searchDatedEventContent,
  searchPlanItems,
  searchSharedPlanItems,
  type PlanItemSearchResult,
} from "@/lib/supabase";
import {
  eventDateToPlannedDate,
  parseEventDate,
  type DatedItemData,
} from "@/lib/event-date";

const RESULT_LIMIT = 20;

// GET search everything the planner can show: the user's own planned
// items (notes + scheduled content), items friends shared with them,
// and dated events that auto-appear on the calendar.
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (query.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const [ownItems, sharedItems, eventContent] = await Promise.all([
      searchPlanItems(session.userId, query, RESULT_LIMIT),
      searchSharedPlanItems(session.userId, query, RESULT_LIMIT).catch(
        (err) => {
          // Sharing tables may not exist yet; own-item search still works
          console.error("Shared-item search failed:", err);
          return [] as PlanItemSearchResult[];
        },
      ),
      searchDatedEventContent(session.userId, query, RESULT_LIMIT),
    ]);

    const results = [...ownItems, ...sharedItems];

    // Auto-injected events: only those with a parseable date and no
    // existing plan item already covering the same content.
    const plannedContentIds = new Set(
      results.map((r) => r.content_id).filter(Boolean),
    );
    for (const content of eventContent) {
      if (plannedContentIds.has(content.id)) continue;
      const dated = content.data as DatedItemData;
      // The first day is the one worth surfacing in a search result: a stay is
      // one thing you booked, not a row per night.
      const eventDate = parseEventDate(dated.date, dated.time);
      if (!eventDate) continue;
      results.push({
        id: `auto-event-${content.id}`,
        planned_date: eventDateToPlannedDate(eventDate),
        title: content.title,
        category: content.category,
        thumbnail_url: content.thumbnail_url ?? null,
        is_note: false,
        content_id: content.id,
      });
    }

    results.sort((a, b) => b.planned_date.localeCompare(a.planned_date));

    return NextResponse.json({
      success: true,
      results: results.slice(0, RESULT_LIMIT),
    });
  } catch (error) {
    console.error("Error searching plan items:", error);
    return NextResponse.json(
      { error: "Failed to search plan items" },
      { status: 500 },
    );
  }
}
