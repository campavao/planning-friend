import { NextRequest, NextResponse } from "next/server";
import { getUserSettings, upsertUserSettings } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import { updateUserSettingsBodySchema } from "@/lib/schemas/settings";
import { resolveNoteReminderSettings } from "@/lib/note-reminders";

// GET - Get user settings
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const settings = await getUserSettings(session.userId);

    // The note-reminder columns may be absent — no row yet for a user who has
    // never saved anything, or the migration not applied — so the response
    // always carries the effective values rather than making each client
    // reimplement the defaults.
    const noteReminders = resolveNoteReminderSettings(settings);

    return NextResponse.json({
      settings: {
        ...settings,
        note_reminders_enabled: noteReminders.enabled,
        note_reminder_delay_minutes: noteReminders.delayMinutes,
      },
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Update user settings
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    // Parsed, not destructured: the previous `const { home_region,
    // home_country } = ...` silently dropped every other field, so a new
    // setting looked saved and never was.
    const parsed = updateUserSettingsBodySchema.safeParse(
      await request.json()
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const settings = await upsertUserSettings(session.userId, parsed.data);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
