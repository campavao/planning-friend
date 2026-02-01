import { NextRequest, NextResponse } from "next/server";
import {
  getUserByCalendarToken,
  getPlanItemsForDateRange,
  type PlanItem,
  type Content,
  type MealData,
  type EventData,
  type DateIdeaData,
  type DrinkData,
} from "@/lib/supabase";
import { parseDateString } from "@/lib/utils";

// Helper to escape iCal text values
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Helper to format date for iCal (all-day event)
function formatICalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// Helper to generate a unique ID for each event
function generateEventId(item: PlanItem, weekStart: string): string {
  return `${item.id}-${weekStart}@planningfriend.app`;
}

// Build description from content data
function buildDescription(content: Content | undefined, noteTitle?: string): string {
  if (!content) {
    return noteTitle || "";
  }

  const parts: string[] = [];

  // Add category
  parts.push(`Category: ${content.category.replace("_", " ")}`);

  // Add category-specific data
  if (content.category === "meal") {
    const data = content.data as MealData;
    if (data.prep_time) parts.push(`Prep time: ${data.prep_time}`);
    if (data.cook_time) parts.push(`Cook time: ${data.cook_time}`);
    if (data.servings) parts.push(`Servings: ${data.servings}`);
    if (data.ingredients && data.ingredients.length > 0) {
      parts.push(`\nIngredients:\n${data.ingredients.map((i) => `- ${i}`).join("\n")}`);
    }
    if (data.recipe && data.recipe.length > 0) {
      parts.push(`\nRecipe:\n${data.recipe.map((step, i) => `${i + 1}. ${step}`).join("\n")}`);
    }
  } else if (content.category === "drink") {
    const data = content.data as DrinkData;
    if (data.type) parts.push(`Type: ${data.type}`);
    if (data.prep_time) parts.push(`Prep time: ${data.prep_time}`);
    if (data.difficulty) parts.push(`Difficulty: ${data.difficulty}`);
    if (data.ingredients && data.ingredients.length > 0) {
      parts.push(`\nIngredients:\n${data.ingredients.map((i) => `- ${i}`).join("\n")}`);
    }
    if (data.recipe && data.recipe.length > 0) {
      parts.push(`\nRecipe:\n${data.recipe.map((step, i) => `${i + 1}. ${step}`).join("\n")}`);
    }
  } else if (content.category === "event") {
    const data = content.data as EventData;
    if (data.description) parts.push(data.description);
    if (data.date) parts.push(`Date: ${data.date}`);
    if (data.time) parts.push(`Time: ${data.time}`);
    if (data.website) parts.push(`Website: ${data.website}`);
    if (data.ticket_link) parts.push(`Tickets: ${data.ticket_link}`);
  } else if (content.category === "date_idea") {
    const data = content.data as DateIdeaData;
    if (data.description) parts.push(data.description);
    if (data.type) parts.push(`Type: ${data.type}`);
    if (data.price_range) parts.push(`Price: ${data.price_range}`);
    if (data.website) parts.push(`Website: ${data.website}`);
    if (data.menu_link) parts.push(`Menu: ${data.menu_link}`);
    if (data.reservation_link) parts.push(`Reservations: ${data.reservation_link}`);
  }

  // Add source URL if available
  if (content.tiktok_url) {
    parts.push(`\nSource: ${content.tiktok_url}`);
  }

  return parts.join("\n");
}

// Get location from content data
function getLocation(content: Content | undefined): string | undefined {
  if (!content) return undefined;

  if (content.category === "event") {
    const data = content.data as EventData;
    return data.location;
  } else if (content.category === "date_idea") {
    const data = content.data as DateIdeaData;
    return data.location;
  }

  return undefined;
}

// GET iCal feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse("Missing token parameter", { status: 400 });
    }

    // Validate token and get user
    const user = await getUserByCalendarToken(token);
    if (!user) {
      return new NextResponse("Invalid or expired token", { status: 401 });
    }

    // Get date range: 4 weeks back, 12 weeks forward
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 28);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 84);

    // Get all plan items in range
    const items = await getPlanItemsForDateRange(user.id, startDate, endDate);

    // Build iCal content
    const calendarLines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Planning Friend//Weekly Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICalText(user.name ? `${user.name}'s Planner` : "My Planner")}`,
      "X-WR-TIMEZONE:UTC",
    ];

    // Add events for each plan item
    for (const item of items) {
      const itemWithWeekStart = item as PlanItem & { week_start: string };
      const weekStart = parseDateString(itemWithWeekStart.week_start);
      
      // Calculate the actual date of this item
      const itemDate = new Date(weekStart);
      itemDate.setDate(itemDate.getDate() + item.day_of_week);

      const title = item.note_title || item.content?.title || "Plan Item";
      const description = buildDescription(item.content, item.note_title);
      const location = getLocation(item.content);

      calendarLines.push("BEGIN:VEVENT");
      calendarLines.push(`UID:${generateEventId(item, itemWithWeekStart.week_start)}`);
      calendarLines.push(`DTSTAMP:${formatICalDate(new Date())}T000000Z`);
      calendarLines.push(`DTSTART;VALUE=DATE:${formatICalDate(itemDate)}`);
      calendarLines.push(`DTEND;VALUE=DATE:${formatICalDate(new Date(itemDate.getTime() + 86400000))}`);
      calendarLines.push(`SUMMARY:${escapeICalText(title)}`);
      
      if (description) {
        calendarLines.push(`DESCRIPTION:${escapeICalText(description)}`);
      }
      
      if (location) {
        calendarLines.push(`LOCATION:${escapeICalText(location)}`);
      }

      // Add categories based on content type
      if (item.content?.category) {
        const category = item.content.category.replace("_", " ").toUpperCase();
        calendarLines.push(`CATEGORIES:${category}`);
      } else if (item.note_title) {
        calendarLines.push("CATEGORIES:QUICK NOTE");
      }

      calendarLines.push("END:VEVENT");
    }

    calendarLines.push("END:VCALENDAR");

    // Return as iCal file
    const icalContent = calendarLines.join("\r\n");

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="planner.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error generating iCal feed:", error);
    return new NextResponse("Failed to generate calendar feed", { status: 500 });
  }
}
