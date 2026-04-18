import { NextRequest, NextResponse } from "next/server";
import {
  getSharedItemsForUser,
  getWeeklyPlanWithItems,
  getWeekStart,
  type DateIdeaData,
  type EventData,
  type PlanItem,
  type SharedPlanItem,
} from "@/lib/supabase";
import { requireAlexaToken } from "@/lib/alexa-auth";
import { escapeSsml } from "@/lib/alexa-speech";

interface WeekItem {
  id: string;
  title: string;
  category: string;
  plannedDate: string;
  location?: string;
  sharedBy?: string;
}

interface WeekDay {
  date: string;
  dayName: string;
  items: WeekItem[];
}

interface WeekResponse {
  weekStart: string;
  totalItems: number;
  days: WeekDay[];
  speech: string;
}

// Returns the full 7-day view starting Monday of the week containing
// the requested date (defaults to current week). Used by WeekPlanIntent.
export async function GET(request: NextRequest) {
  const { context, errorResponse } = requireAlexaToken(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("week");
  const dateParam = searchParams.get("date");

  let anchor: string;
  if (weekParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      return NextResponse.json(
        { error: "week must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    anchor = weekParam;
  } else if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    anchor = dateParam;
  } else {
    anchor = new Date().toISOString().slice(0, 10);
  }

  try {
    const weekStart = getWeekStart(new Date(anchor + "T12:00:00Z"));
    const plan = await getWeeklyPlanWithItems(context.userId, weekStart);

    let sharedItems: SharedPlanItem[] = [];
    try {
      sharedItems = await getSharedItemsForUser(context.userId, weekStart);
    } catch (err) {
      console.error("Failed to fetch shared items:", err);
    }

    const days = buildDays(weekStart, plan?.items ?? [], sharedItems);
    const totalItems = days.reduce((sum, d) => sum + d.items.length, 0);

    const body: WeekResponse = {
      weekStart,
      totalItems,
      days,
      speech: buildSpeech(weekStart, days, totalItems),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Error fetching Alexa week:", error);
    return NextResponse.json(
      { error: "Failed to fetch week" },
      { status: 500 }
    );
  }
}

function buildDays(
  weekStart: string,
  items: PlanItem[],
  sharedItems: SharedPlanItem[]
): WeekDay[] {
  const days: WeekDay[] = [];
  const start = new Date(weekStart + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
    const dayStart = Date.parse(dateStr + "T00:00:00.000Z");
    const dayEnd = Date.parse(dateStr + "T23:59:59.999Z");
    const withinDay = (value: string) => {
      const t = Date.parse(value);
      return !Number.isNaN(t) && t >= dayStart && t <= dayEnd;
    };

    const own = items
      .filter((item) => withinDay(item.planned_date))
      .map((item) => shapeItem(item));
    const shared = sharedItems
      .filter((item) => withinDay(item.planned_date))
      .map((item) => shapeItem(item, item.owner_name));

    days.push({
      date: dateStr,
      dayName,
      items: [...own, ...shared].sort(
        (a, b) => Date.parse(a.plannedDate) - Date.parse(b.plannedDate)
      ),
    });
  }
  return days;
}

function shapeItem(item: PlanItem, sharedBy?: string): WeekItem {
  const title = item.content?.title ?? item.note_title ?? "Untitled item";
  const category = item.content?.category ?? "other";
  return {
    id: item.id,
    title,
    category,
    plannedDate: item.planned_date,
    location: shortenLocation(extractLocation(item.content?.data, category)),
    sharedBy,
  };
}

function extractLocation(data: unknown, category: string): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  if (category === "event") return (data as EventData).location;
  if (category === "date_idea") return (data as DateIdeaData).location;
  return undefined;
}

function shortenLocation(location?: string): string | undefined {
  if (!location) return undefined;
  const first = location.split(",")[0].trim();
  return first || undefined;
}

function buildSpeech(
  weekStart: string,
  days: WeekDay[],
  totalItems: number
): string {
  const weekLabel = weekLabelRelativeToToday(weekStart);
  if (totalItems === 0) {
    return `You don't have anything planned ${weekLabel}.`;
  }

  const countPhrase =
    totalItems === 1 ? "one thing" : `${totalItems} things`;
  const daysWithItems = days.filter((d) => d.items.length > 0);

  const daySummaries = daysWithItems.map((d) => {
    const titles = d.items.map((i) => escapeSsml(i.title));
    return `${d.dayName}: ${joinList(titles)}`;
  });

  return `You have ${countPhrase} planned ${weekLabel}. ${daySummaries.join(". ")}.`;
}

function weekLabelRelativeToToday(weekStart: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const todayWeekStart = mondayOf(today);
  if (weekStart === todayWeekStart) return "this week";
  const delta = daysBetween(todayWeekStart, weekStart);
  if (delta === 7) return "next week";
  if (delta === -7) return "last week";
  const d = new Date(weekStart + "T12:00:00Z");
  return (
    "for the week of " +
    d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  );
}

function mondayOf(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const aMs = Date.parse(a + "T00:00:00.000Z");
  const bMs = Date.parse(b + "T00:00:00.000Z");
  return Math.round((bMs - aMs) / 86_400_000);
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
