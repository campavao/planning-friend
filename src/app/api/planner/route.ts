import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateWeeklyPlan,
  getWeeklyPlanWithItems,
  addPlanItem,
  getWeekStart,
  getContentByUser,
  getSharedPlansWithDetails,
  getPlanShareInfo,
  type Content,
  type ContentCategory,
} from "@/lib/supabase";
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

    // Get all user's content for adding to plan
    const allContent = await getContentByUser(session.userId);
    const availableContent = allContent.filter(
      (c) => c.status === "completed"
    );

    // Generate suggestions based on patterns
    const suggestions = generateSuggestions(plan?.items || [], availableContent);

    // Get shared plans information
    const sharedWithMe = await getSharedPlansWithDetails(session.userId);
    
    // Get share info for current plan (if user owns it)
    const shareInfo = plan ? await getPlanShareInfo(plan.id, session.userId) : { isShared: false, sharedWith: [] };

    return NextResponse.json({
      success: true,
      plan,
      availableContent,
      suggestions,
      sharedWithMe,
      shareInfo,
    });
  } catch (error) {
    console.error("Error getting planner:", error);
    return NextResponse.json(
      { error: "Failed to get planner" },
      { status: 500 }
    );
  }
}

// POST add item to plan
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { weekStart, contentId, dayOfWeek, notes } = body;

    if (contentId === undefined || dayOfWeek === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create the plan
    const plan = await getOrCreateWeeklyPlan(
      session.userId,
      weekStart || getWeekStart()
    );

    // Add the item
    const item = await addPlanItem(plan.id, contentId, dayOfWeek, notes);

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

