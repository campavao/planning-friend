import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateWeeklyPlan,
  getWeeklyPlanWithItems,
  addPlanItem,
  getWeekStart,
  getContentWithTags,
  getSharedItemsForUser,
  getPlanItemShares,
  getFriends,
  getUserTags,
  type ContentWithTags,
  type EventData,
  type PlanItem,
  type SharedPlanItem,
} from "@/lib/supabase";
import { parseDateString } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import {
  getOrComputeSuggestions,
  type ThisWeekItemRef,
} from "@/lib/recommendations";
import { bustCacheForWeek } from "@/lib/db/suggestions";

// Extended plan item with sharing info
interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  is_auto_event?: boolean;
  shared_with?: { userId: string; name: string }[];
}

// GET weekly plan
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week") || getWeekStart();

    // Get plan with items
    const plan = await getWeeklyPlanWithItems(session.userId, weekStart);

    // Get all user's content with tags for adding to plan
    const allContent = await getContentWithTags(session.userId);
    const availableContent = allContent.filter((c) => c.status === "completed");

    // Get all user tags for the filter UI
    const allTags = await getUserTags(session.userId);

    // Get items shared with this user for this week
    let sharedItems: SharedPlanItem[] = [];
    try {
      sharedItems = await getSharedItemsForUser(session.userId, weekStart);
    } catch (error) {
      // Table might not exist yet, continue without shared items
      console.error("Error getting shared items:", error);
    }

    // Get user's friends with linked accounts (for sharing UI)
    const friends = await getFriends(session.userId);
    const shareableFriends = friends
      .filter((f) => f.linked_user_id)
      .map((f) => ({
        id: f.id,
        name: f.name,
        linkedUserId: f.linked_user_id,
        isFavorite: f.is_favorite,
      }));

    // Enhance own items with sharing info
    const ownItemsWithSharing: PlanItemWithSharing[] = [];
    if (plan?.items) {
      for (const item of plan.items) {
        try {
          const shares = await getPlanItemShares(item.id);
          // Map shared_with_user_id to friend names
          const sharedWith = shares.map((share) => {
            const friend = friends.find(
              (f) => f.linked_user_id === share.shared_with_user_id,
            );
            return {
              userId: share.shared_with_user_id,
              name: friend?.name || "Friend",
            };
          });

          ownItemsWithSharing.push({
            ...item,
            is_owner: true,
            shared_with: sharedWith.length > 0 ? sharedWith : undefined,
          });
        } catch {
          // If sharing lookup fails, just include the item without sharing info
          ownItemsWithSharing.push({
            ...item,
            is_owner: true,
          });
        }
      }
    }

    // Auto-add events that have dates falling within this week
    const autoEventItems = getAutoEventItems(
      availableContent,
      weekStart,
      ownItemsWithSharing,
    );
    const allOwnItems = [...ownItemsWithSharing, ...autoEventItems];

    // Build the "this week" snapshot for the suggestion engine. Include
    // own items, auto-injected events, and shared items so we don't suggest
    // anything for a day that's already populated.
    const thisWeekItems: ThisWeekItemRef[] = [];
    for (const item of allOwnItems) {
      thisWeekItems.push({
        plannedDate: item.planned_date,
        contentId: item.content_id ?? null,
        category: item.content?.category ?? null,
        title: item.content?.title ?? item.note_title ?? null,
      });
    }
    for (const item of sharedItems) {
      thisWeekItems.push({
        plannedDate: item.planned_date,
        contentId: item.content_id ?? null,
        category: item.content?.category ?? null,
        title: item.content?.title ?? null,
      });
    }

    const featureEnabled =
      process.env.NEXT_PUBLIC_SMART_SUGGESTIONS_ENABLED === "true";

    let suggestions: Record<
      number,
      { contentId: string; why: string | null }[]
    > = {};
    let suggestionsMeta: { emptyPool: boolean; poolSize: number } = {
      emptyPool: false,
      poolSize: 0,
    };
    if (featureEnabled) {
      try {
        const result = await getOrComputeSuggestions({
          userId: session.userId,
          weekStart,
          thisWeekItems,
          curatorEnabled: true,
        });
        suggestions = result.payload;
        suggestionsMeta = {
          emptyPool: result.emptyPool,
          poolSize: result.poolSize,
        };
      } catch (err) {
        console.error("Failed to compute suggestions:", err);
      }
    }

    return NextResponse.json({
      success: true,
      plan: plan
        ? {
            ...plan,
            items: allOwnItems,
          }
        : null,
      sharedItems,
      availableContent,
      suggestions,
      suggestionsMeta,
      shareableFriends,
      allTags,
    });
  } catch (error) {
    console.error("Error getting planner:", error);
    return NextResponse.json(
      { error: "Failed to get planner" },
      { status: 500 },
    );
  }
}

// POST add item to plan (content or quick note)
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      weekStart,
      contentId,
      noteTitle,
      dayOfWeek,
      notes,
      plannedDate,
      source,
    } = body;

    if (!contentId && !noteTitle) {
      return NextResponse.json(
        { error: "Either contentId or noteTitle is required" },
        { status: 400 },
      );
    }

    let resolvedPlannedDate: string | undefined = plannedDate;
    if (!resolvedPlannedDate && dayOfWeek !== undefined) {
      const plannedDateObj = parseDateString(weekStart || getWeekStart());
      plannedDateObj.setDate(plannedDateObj.getDate() + dayOfWeek);
      plannedDateObj.setHours(19, 0, 0, 0); // Default to 7:00 PM local time
      resolvedPlannedDate = plannedDateObj.toISOString();
    }
    if (!resolvedPlannedDate) {
      return NextResponse.json(
        { error: "plannedDate is required" },
        { status: 400 },
      );
    }

    const plannedDateOnly = resolvedPlannedDate.split("T")[0];
    const planWeekStart = getWeekStart(parseDateString(plannedDateOnly));

    // Get or create the plan
    const plan = await getOrCreateWeeklyPlan(session.userId, planWeekStart);

    const validSource: "manual" | "ai_suggested" | "quick_note" | undefined =
      source === "ai_suggested" || source === "manual" || source === "quick_note"
        ? source
        : undefined;

    const item = await addPlanItem(plan.id, {
      contentId,
      noteTitle,
      notes,
      plannedDate: resolvedPlannedDate,
      source: validSource,
    });

    bustCacheForWeek(session.userId, planWeekStart).catch((err) => {
      console.error("Failed to bust suggestion cache after add:", err);
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Error adding plan item:", error);
    return NextResponse.json(
      { error: "Failed to add item to plan" },
      { status: 500 },
    );
  }
}

// Parse a free-form event date string (e.g. "Saturday, April 18, 2026") into a Date
function parseEventDate(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;

  // Try parsing the date string directly - works for many natural formats
  // Remove day-of-week prefix like "Saturday, " if present
  const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, "");
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    // Apply time if provided
    if (timeStr) {
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2] || "0", 10);
        const period = timeMatch[3]?.toUpperCase();
        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        parsed.setHours(hours, minutes, 0, 0);
      }
    }
    return parsed;
  }

  return null;
}

// Create synthetic plan items for events with dates in the current week
function getAutoEventItems(
  availableContent: ContentWithTags[],
  weekStart: string,
  existingItems: PlanItemWithSharing[],
): PlanItemWithSharing[] {
  const weekStartDate = parseDateString(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);

  // Content IDs already in the plan (to avoid duplicates)
  const existingContentIds = new Set(
    existingItems
      .filter((item) => item.content_id)
      .map((item) => item.content_id),
  );

  const autoItems: PlanItemWithSharing[] = [];

  for (const content of availableContent) {
    if (content.category !== "event") continue;
    if (existingContentIds.has(content.id)) continue;

    const eventData = content.data as EventData;
    const eventDate = parseEventDate(eventData.date, eventData.time);
    if (!eventDate) continue;

    // Check if event falls within this week
    if (eventDate >= weekStartDate && eventDate <= weekEndDate) {
      // Create a synthetic plan item
      const plannedDate = new Date(
        Date.UTC(
          eventDate.getFullYear(),
          eventDate.getMonth(),
          eventDate.getDate(),
          eventDate.getHours(),
          eventDate.getMinutes(),
          0,
          0,
        ),
      );

      autoItems.push({
        id: `auto-event-${content.id}`,
        plan_id: "",
        content_id: content.id,
        planned_date: plannedDate.toISOString(),
        slot_order: 999, // Show after manually added items
        created_at: content.created_at,
        content: content,
        is_owner: true,
        is_auto_event: true,
      });
    }
  }

  return autoItems;
}
