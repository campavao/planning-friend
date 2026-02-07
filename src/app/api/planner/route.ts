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
  type Content,
  type ContentCategory,
  type PlanItem,
  type SharedPlanItem,
} from "@/lib/supabase";
import { parseDateString } from "@/lib/utils";
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
      Buffer.from(sessionCookie.value, "base64").toString(),
    ) as SessionData;

    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// Extended plan item with sharing info
interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  shared_with?: { userId: string; name: string }[];
}

// GET weekly plan
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week") || getWeekStart();

    // Get or create the plan
    await getOrCreateWeeklyPlan(session.userId, weekStart);

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

    // Generate suggestions based on patterns (using own items only)
    const suggestions = generateSuggestions(
      plan?.items || [],
      availableContent,
    );

    return NextResponse.json({
      success: true,
      plan: plan
        ? {
            ...plan,
            items: ownItemsWithSharing,
          }
        : null,
      sharedItems,
      availableContent,
      suggestions,
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
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { weekStart, contentId, noteTitle, dayOfWeek, notes, plannedDate } =
      body;

    if (!contentId && !noteTitle) {
      return NextResponse.json(
        { error: "Either contentId or noteTitle is required" },
        { status: 400 },
      );
    }

    // Get or create the plan
    const resolvedWeekStart = weekStart || getWeekStart();
    const plan = await getOrCreateWeeklyPlan(session.userId, resolvedWeekStart);

    let resolvedPlannedDate: string | undefined = plannedDate;
    if (!resolvedPlannedDate && dayOfWeek !== undefined) {
      const plannedDateObj = parseDateString(plan.week_start);
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

    // Add the item (either content or quick note)
    const item = await addPlanItem(plan.id, {
      contentId,
      noteTitle,
      notes,
      plannedDate: resolvedPlannedDate,
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

// Generate smart suggestions based on content and patterns
function generateSuggestions(
  existingItems: { planned_date: string; content?: Content }[],
  availableContent: Content[],
): Record<number, Content[]> {
  const suggestions: Record<number, Content[]> = {};
  const usedContentIds = new Set(
    existingItems.map((item) => item.content?.id).filter(Boolean),
  );

  // Day name patterns - what categories typically go on each day
  const dayPatterns: Record<number, ContentCategory[]> = {
    0: ["meal"], // Monday - start the week with a home meal
    1: ["meal", "date_idea"], // Tuesday
    2: ["meal"], // Wednesday
    3: ["date_idea", "event"], // Thursday - date night
    4: ["date_idea", "event"], // Friday - going out
    5: ["event", "date_idea"], // Saturday - activities
    6: ["meal"], // Sunday - home cooking
  };

  const getMondayIndex = (value: string) => {
    const planned = new Date(value);
    if (Number.isNaN(planned.getTime())) return null;
    return (planned.getDay() + 6) % 7;
  };

  for (let day = 0; day <= 6; day++) {
    const dayItems = existingItems.filter((item) => {
      const dayIndex = getMondayIndex(item.planned_date);
      return dayIndex === day;
    });

    // If day is empty, suggest content
    if (dayItems.length === 0) {
      const preferredCategories = dayPatterns[day] || ["meal", "date_idea"];

      const daySuggestions = availableContent
        .filter((content) => {
          // Not already used this week
          if (usedContentIds.has(content.id)) return false;
          // Matches preferred category for this day
          return preferredCategories.includes(content.category);
        })
        .slice(0, 3); // Max 3 suggestions per day

      if (daySuggestions.length > 0) {
        suggestions[day] = daySuggestions;
      }
    }
  }

  return suggestions;
}
