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

export async function upsertUserSettings(
  userId: string,
  settings: { home_region?: string; home_country?: string }
): Promise<UserSettings> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user settings: ${error.message}`);
  }

  return data as UserSettings;
}
