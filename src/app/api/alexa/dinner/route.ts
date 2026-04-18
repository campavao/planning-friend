import { NextRequest, NextResponse } from "next/server";
import {
  getSharedItemsForUser,
  getWeeklyPlanWithItems,
  getWeekStart,
  type PlanItem,
  type SharedPlanItem,
} from "@/lib/supabase";
import { requireAlexaToken } from "@/lib/alexa-auth";

interface DinnerResponse {
  found: boolean;
  id?: string;
  title?: string;
  sharedBy?: string;
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

    let sharedItems: SharedPlanItem[] = [];
    try {
      sharedItems = await getSharedItemsForUser(context.userId, weekStart);
    } catch (err) {
      console.error("Failed to fetch shared items:", err);
    }

    const dayStart = Date.parse(date + "T00:00:00.000Z");
    const dayEnd = Date.parse(date + "T23:59:59.999Z");
    const isMealInDay = (item: PlanItem) => {
      const t = Date.parse(item.planned_date);
      if (Number.isNaN(t) || t < dayStart || t > dayEnd) return false;
      return item.content?.category === "meal";
    };

    type Candidate = { item: PlanItem; sharedBy?: string };
    const candidates: Candidate[] = [
      ...((plan?.items ?? [])
        .filter(isMealInDay)
        .map((item) => ({ item }))),
      ...sharedItems
        .filter(isMealInDay)
        .map((item) => ({ item: item as PlanItem, sharedBy: item.owner_name })),
    ];
    candidates.sort(
      (a, b) =>
        Date.parse(a.item.planned_date) - Date.parse(b.item.planned_date)
    );
    const winner = candidates[0];

    const dateLabel = formatDateForSpeech(date);

    if (!winner || !winner.item.content) {
      const body: DinnerResponse = {
        found: false,
        speech: `You don't have a meal planned for ${dateLabel}.`,
      };
      return NextResponse.json(body);
    }

    const body: DinnerResponse = {
      found: true,
      id: winner.item.content.id,
      title: winner.item.content.title,
      sharedBy: winner.sharedBy,
      speech: buildSpeech(
        date === todayIso() ? null : dateLabel,
        winner.item.content.title
      ),
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSpeech(dateLabel: string | null, title: string): string {
  return dateLabel
    ? `Dinner ${dateLabel} is ${title}.`
    : `Dinner is ${title}.`;
}

function formatDateForSpeech(date: string): string {
  const today = todayIso();
  const delta = daysBetween(today, date);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  const d = new Date(date + "T12:00:00Z");
  if (delta > 1 && delta < 7) {
    return "on " + d.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
  }
  return "on " + d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function daysBetween(a: string, b: string): number {
  const aMs = Date.parse(a + "T00:00:00.000Z");
  const bMs = Date.parse(b + "T00:00:00.000Z");
  return Math.round((bMs - aMs) / 86_400_000);
}
