import { NextRequest, NextResponse } from "next/server";
import { getWeeklyPlanWithItems, getWeekStart } from "@/lib/supabase";
import { requireAlexaToken } from "@/lib/alexa-auth";

interface DinnerResponse {
  found: boolean;
  id?: string;
  title?: string;
  speech: string;
}

// Returns tonight's planned meal (shortcut for WhatsForDinnerIntent).
// Picks the first meal-category plan item for the date; ignores other
// categories even if they're scheduled for later in the day.
export async function GET(request: NextRequest) {
  const { context, errorResponse } = requireAlexaToken(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const weekStart = getWeekStart(new Date(date + "T12:00:00Z"));
    const plan = await getWeeklyPlanWithItems(context.userId, weekStart);
    const dayStart = Date.parse(date + "T00:00:00.000Z");
    const dayEnd = Date.parse(date + "T23:59:59.999Z");

    const meal = (plan?.items ?? [])
      .filter((item) => {
        const t = Date.parse(item.planned_date);
        if (Number.isNaN(t) || t < dayStart || t > dayEnd) return false;
        return item.content?.category === "meal";
      })
      .sort((a, b) => Date.parse(a.planned_date) - Date.parse(b.planned_date))[0];

    if (!meal || !meal.content) {
      const body: DinnerResponse = {
        found: false,
        speech: "You don't have a meal planned for today.",
      };
      return NextResponse.json(body);
    }

    const body: DinnerResponse = {
      found: true,
      id: meal.content.id,
      title: meal.content.title,
      speech: `Dinner is ${meal.content.title}.`,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Error fetching Alexa dinner:", error);
    return NextResponse.json(
      { error: "Failed to fetch dinner" },
      { status: 500 }
    );
  }
}
