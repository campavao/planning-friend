import { NextRequest, NextResponse } from "next/server";
import {
  claimNoteReminder,
  getNoteReminderCandidates,
  getUserSettings,
} from "@/lib/supabase";
import type { UserSettings } from "@/lib/db/types";
import { isPushConfigured, notifyAddNote } from "@/lib/push-notifications";
import {
  noteReminderQueryWindow,
  resolveNoteReminderSettings,
  shouldSendNoteReminder,
  type NoteReminderSettings,
  type NoteReminderSkipReason,
} from "@/lib/note-reminders";

// Reads "now" and the database on every invocation; nothing here is cacheable.
export const dynamic = "force-dynamic";

/**
 * Vercel Cron signs its requests with `Authorization: Bearer $CRON_SECRET`.
 * An unset secret fails closed rather than open — an unauthenticated endpoint
 * that sends pushes is a spam vector, so a deployment that forgot the env var
 * should send nothing at all.
 */
function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bail before claiming anything: claiming stamps note_reminder_sent_at, so
  // running without VAPID keys would burn every pending reminder silently.
  if (!isPushConfigured()) {
    return NextResponse.json({
      success: false,
      error: "Push notifications are not configured",
    });
  }

  try {
    const now = new Date();
    const { fromIso, toIso } = noteReminderQueryWindow(now);
    const candidates = await getNoteReminderCandidates(fromIso, toIso);

    // One settings read per user, not per plan item — a busy week is many
    // items belonging to the same handful of people.
    const settingsByUser = new Map<string, NoteReminderSettings>();
    const settingsFor = async (userId: string) => {
      const cached = settingsByUser.get(userId);
      if (cached) return cached;
      let row: UserSettings | null = null;
      try {
        row = await getUserSettings(userId);
      } catch (error) {
        // A settings read failure must not mean "reminders off" for everyone;
        // the resolved defaults are the documented behaviour for a user with
        // no row at all.
        console.error("Failed to read settings for", userId, error);
      }
      const resolved = resolveNoteReminderSettings(row);
      settingsByUser.set(userId, resolved);
      return resolved;
    };

    let sent = 0;
    let failed = 0;
    const skipped: Record<string, number> = {};
    const countSkip = (reason: NoteReminderSkipReason | "claimed_elsewhere") => {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
    };

    for (const candidate of candidates) {
      const settings = await settingsFor(candidate.userId);
      const decision = shouldSendNoteReminder(candidate, settings, now);

      if (!decision.send) {
        countSkip(decision.reason);
        continue;
      }

      // Stamp first, send second. A push that fails costs one lost reminder;
      // a stamp that lands after a crash costs a duplicate notification, and
      // the duplicate is the worse outcome.
      const claimed = await claimNoteReminder(candidate.planItemId, now.toISOString());
      if (!claimed) {
        countSkip("claimed_elsewhere");
        continue;
      }

      try {
        await notifyAddNote(
          candidate.userId,
          candidate.contentId!,
          candidate.contentTitle
        );
        sent += 1;
      } catch (error) {
        console.error(
          "Failed to send note reminder for plan item",
          candidate.planItemId,
          error
        );
        failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      considered: candidates.length,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("Note reminder cron failed:", error);
    return NextResponse.json(
      { error: "Note reminder cron failed" },
      { status: 500 }
    );
  }
}
