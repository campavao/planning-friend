import { createServerClient } from "./client";
import type { UserSettings } from "./types";

export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get user settings: ${error.message}`);
  }

  return data as UserSettings | null;
}

/**
 * Every writable settings column. Typed as a Partial of the row rather than a
 * hand-listed shape: a narrow inline type here is how a new setting ends up
 * appearing to save while being dropped on the floor.
 */
export type UserSettingsUpdate = Partial<
  Pick<
    UserSettings,
    | "home_region"
    | "home_country"
    | "note_reminders_enabled"
    | "note_reminder_delay_minutes"
  >
>;

export async function upsertUserSettings(
  userId: string,
  settings: UserSettingsUpdate
): Promise<UserSettings> {
  const supabase = createServerClient();

  // Undefined keys are stripped rather than sent: PostgREST would write them
  // as NULL, so a caller updating only the location would wipe the reminder
  // preferences.
  const changes = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined)
  );

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        ...changes,
        updated_at: new Date().toISOString(),
      },
      // user_id is the row's real identity here (UNIQUE in schema-v2.sql); the
      // id primary key is never supplied by the caller, so the conflict target
      // has to be named explicitly for a second save to update rather than
      // collide.
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user settings: ${error.message}`);
  }

  return data as UserSettings;
}
