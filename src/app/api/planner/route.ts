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
import { formatDateString, parseDateString } from "@/lib/utils";
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

// Extended plan item with sharing info
interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  shared_with?: { userId: string; name: string }[];
}

function getSundayStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return formatDateString(d);
}

async function enhanceItemsWithSharing(
  items: PlanItem[] | undefined,
  friends: { linked_user_id?: string | null; name: string }[]
): Promise<PlanItemWithSharing[]> {
  if (!items || items.length === 0) return [];

  const enhanced = await Promise.all(
    items.map(async (item) => {
      try {
        const shares = await getPlanItemShares(item.id);
        const sharedWith = shares.map((share) => {
          const friend = friends.find(
            (f) => (f.linked_user_id ?? null) === share.shared_with_user_id
          );
          return {
            userId: share.shared_with_user_id,
            name: friend?.name || "Friend",
          };
        });

        return {
          ...item,
          is_owner: true,
          shared_with: sharedWith.length > 0 ? sharedWith : undefined,
        };
      } catch {
        return {
          ...item,
          is_owner: true,
        };
      }
    })
  );

  return enhanced;
}

// GET weekly plan
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekMode = searchParams.get("weekMode");
    const weekParam = searchParams.get("week");

    // Get all user's content with tags for adding to plan
    const allContent = await getContentWithTags(session.userId);
    const availableContent = allContent.filter((c) => c.status === "completed");

    // Get all user tags for the filter UI
    const allTags = await getUserTags(session.userId);

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

    // Sunday-start week mode: merge Sunday from previous backend week + Mon-Sat from current backend week.
    if (weekMode === "sunday") {
      const displaySunday = weekParam ? parseDateString(weekParam) : null;
      const displayWeekStart = displaySunday
        ? formatDateString(displaySunday)
        : getSundayStart();

      const displayStart = parseDateString(displayWeekStart);
      const prevWeekStartDate = new Date(displayStart);
      prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 6); // Monday before this Sunday
      const mainWeekStartDate = new Date(displayStart);
      mainWeekStartDate.setDate(mainWeekStartDate.getDate() + 1); // Monday after this Sunday

      const prevWeekStart = formatDateString(prevWeekStartDate);
      const mainWeekStart = formatDateString(mainWeekStartDate);

      // Ensure both weekly plans exist
      await Promise.all([
        getOrCreateWeeklyPlan(session.userId, prevWeekStart),
        getOrCreateWeeklyPlan(session.userId, mainWeekStart),
      ]);

      const [prevPlan, mainPlan] = await Promise.all([
        getWeeklyPlanWithItems(session.userId, prevWeekStart),
        getWeeklyPlanWithItems(session.userId, mainWeekStart),
      ]);

      // Shared items (best-effort)
      const [prevSharedItems, mainSharedItems] = await Promise.all([
        (async () => {
          try {
            return await getSharedItemsForUser(session.userId, prevWeekStart);
          } catch (error) {
            console.error("Error getting shared items (prev):", error);
            return [] as SharedPlanItem[];
          }
        })(),
        (async () => {
          try {
            return await getSharedItemsForUser(session.userId, mainWeekStart);
          } catch (error) {
            console.error("Error getting shared items (main):", error);
            return [] as SharedPlanItem[];
          }
        })(),
      ]);

      // Enhance own items with sharing info (keep item ids intact)
      const [prevEnhanced, mainEnhanced] = await Promise.all([
        enhanceItemsWithSharing(prevPlan?.items, friends),
        enhanceItemsWithSharing(mainPlan?.items, friends),
      ]);

      // Merge into DISPLAY days: 0=Sun..6=Sat
      const mergedItems: PlanItemWithSharing[] = [
        // Sunday from previous backend week (db day 6 -> display day 0)
        ...prevEnhanced
          .filter((i) => i.day_of_week === 6)
          .map((i) => ({ ...i, day_of_week: 0 })),
        // Mon-Sat from main backend week (db day 0..5 -> display day 1..6)
        ...mainEnhanced
          .filter((i) => i.day_of_week >= 0 && i.day_of_week <= 5)
          .map((i) => ({ ...i, day_of_week: i.day_of_week + 1 })),
      ];

      const mergedSharedItems: SharedPlanItem[] = [
        ...prevSharedItems
          .filter((i) => i.day_of_week === 6)
          .map((i) => ({ ...i, day_of_week: 0 })),
        ...mainSharedItems
          .filter((i) => i.day_of_week >= 0 && i.day_of_week <= 5)
          .map((i) => ({ ...i, day_of_week: i.day_of_week + 1 })),
      ];

      // Suggestions: compute separately and map into DISPLAY indices
      const prevSuggestions = generateSuggestions(prevPlan?.items || [], availableContent);
      const mainSuggestions = generateSuggestions(mainPlan?.items || [], availableContent);
      const mergedSuggestions: Record<number, Content[]> = {};
      if (prevSuggestions[6]) mergedSuggestions[0] = prevSuggestions[6];
      for (let d = 0; d <= 5; d++) {
        if (mainSuggestions[d]) mergedSuggestions[d + 1] = mainSuggestions[d];
      }

      // Use main plan as the "base" plan object in response
      const basePlan = mainPlan || prevPlan;

      return NextResponse.json({
        success: true,
        plan: basePlan
          ? {
              ...basePlan,
              // week_start in DB is Monday, but client is using a Sunday-start week param
              week_start: displayWeekStart,
              items: mergedItems,
            }
          : null,
        sharedItems: mergedSharedItems,
        availableContent,
        suggestions: mergedSuggestions,
        shareableFriends,
        allTags,
      });
    }

    // Default behavior: Monday-start week (existing)
    const weekStart = weekParam || getWeekStart();

    // Get or create the plan
    await getOrCreateWeeklyPlan(session.userId, weekStart);

    // Get plan with items
    const plan = await getWeeklyPlanWithItems(session.userId, weekStart);

    // Get items shared with this user for this week
    let sharedItems: SharedPlanItem[] = [];
    try {
      sharedItems = await getSharedItemsForUser(session.userId, weekStart);
    } catch (error) {
      // Table might not exist yet, continue without shared items
      console.error("Error getting shared items:", error);
    }

    const ownItemsWithSharing = await enhanceItemsWithSharing(plan?.items, friends);

    // Generate suggestions based on patterns (using own items only)
    const suggestions = generateSuggestions(
      plan?.items || [],
      availableContent
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
      { status: 500 }
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
    const { weekStart, contentId, noteTitle, dayOfWeek, notes } = body;

    // Require dayOfWeek and either contentId or noteTitle
    if (dayOfWeek === undefined) {
      return NextResponse.json(
        { error: "dayOfWeek is required" },
        { status: 400 }
      );
    }

    if (!contentId && !noteTitle) {
      return NextResponse.json(
        { error: "Either contentId or noteTitle is required" },
        { status: 400 }
      );
    }

    // Get or create the plan
    const plan = await getOrCreateWeeklyPlan(
      session.userId,
      weekStart || getWeekStart()
    );

    // Add the item (either content or quick note)
    const item = await addPlanItem(plan.id, dayOfWeek, {
      contentId,
      noteTitle,
      notes,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Error adding plan item:", error);
    return NextResponse.json(
      { error: "Failed to add item to plan" },
      { status: 500 }
    );
  }
}

// Generate smart suggestions based on content and patterns
function generateSuggestions(
  existingItems: { day_of_week: number; content?: Content }[],
  availableContent: Content[]
): Record<number, Content[]> {
  const suggestions: Record<number, Content[]> = {};
  const usedContentIds = new Set(
    existingItems.map((item) => item.content?.id).filter(Boolean)
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

  for (let day = 0; day <= 6; day++) {
    const dayItems = existingItems.filter((item) => item.day_of_week === day);

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
