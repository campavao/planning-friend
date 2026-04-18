import { NextRequest, NextResponse } from "next/server";
import {
  getWeeklyPlanWithItems,
  getWeekStart,
  getSharedItemsForUser,
  type DateIdeaData,
  type EventData,
  type PlanItem,
  type SharedPlanItem,
} from "@/lib/supabase";
import { requireAlexaToken } from "@/lib/alexa-auth";
import { escapeSsml } from "@/lib/alexa-speech";

interface AlexaItem {
  id: string;
  title: string;
  category: string;
  notes?: string;
  plannedDate: string;
  location?: string;
  sharedBy?: string;
}

// Read-only endpoint for the Alexa skill Lambda. Returns today's items
// shaped for text-to-speech plus a ready-to-speak summary string.
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
      // Table may not exist in some environments; degrade gracefully.
      console.error("Failed to fetch shared items:", err);
    }

    const dayStart = Date.parse(date + "T00:00:00.000Z");
    const dayEnd = Date.parse(date + "T23:59:59.999Z");
    const withinDay = (value: string) => {
      const t = Date.parse(value);
      return !Number.isNaN(t) && t >= dayStart && t <= dayEnd;
    };

    const ownShaped = (plan?.items ?? [])
      .filter((item) => withinDay(item.planned_date))
      .map((item) => shapeItem(item));

    const sharedShaped = sharedItems
      .filter((item) => withinDay(item.planned_date))
      .map((item) => shapeItem(item, item.owner_name));

    const items: AlexaItem[] = [...ownShaped, ...sharedShaped].sort(
      (a, b) => Date.parse(a.plannedDate) - Date.parse(b.plannedDate)
    );

    return NextResponse.json({
      date,
      items,
      speech: buildSpeech(date, items),
    });
  } catch (error) {
    console.error("Error fetching Alexa today plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

function shapeItem(item: PlanItem, sharedBy?: string): AlexaItem {
  const title = item.content?.title ?? item.note_title ?? "Untitled item";
  const category = item.content?.category ?? "other";
  return {
    id: item.id,
    title,
    category,
    notes: item.notes,
    plannedDate: item.planned_date,
    location: shortenLocation(extractLocation(item.content?.data, category)),
    sharedBy,
  };
}

function shortenLocation(location?: string): string | undefined {
  if (!location) return undefined;
  const first = location.split(",")[0].trim();
  return first || undefined;
}

function extractLocation(data: unknown, category: string): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  if (category === "event") return (data as EventData).location;
  if (category === "date_idea") return (data as DateIdeaData).location;
  return undefined;
}

function buildSpeech(date: string, items: AlexaItem[]): string {
  const dateLabel = formatDateForSpeech(date);
  if (items.length === 0) return `You have nothing planned for ${dateLabel}.`;

  const phrases = items.map((item) => {
    const title = escapeSsml(item.title);
    const location = escapeSsml(item.location);
    if (item.category === "meal") return `${title} for a meal`;
    if (item.category === "event" && location) {
      return `${title} at ${location}`;
    }
    return title;
  });

  const count = items.length === 1 ? "one thing" : `${items.length} things`;
  return `You have ${count} planned for ${dateLabel}: ${joinList(phrases)}.`;
}

function formatDateForSpeech(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const delta = daysBetween(today, date);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  const d = new Date(date + "T12:00:00Z");
  if (delta > 1 && delta < 7) {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", {
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

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
