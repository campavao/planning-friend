import { createServerClient } from "./client";
import type { User } from "./types";
import { checkVerifyOtp, sendVerifyOtp } from "@/lib/twilio";

// Re-exported so existing imports from the db barrel keep working.
export { normalizePhoneNumber } from "@/lib/phone";

export async function sendPhoneOtp(phoneNumber: string): Promise<void> {
  await sendVerifyOtp(phoneNumber);
}

export async function verifyPhoneOtp(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; userId?: string }> {
  const result = await checkVerifyOtp(phoneNumber, code);
  return {
    success: result.success,
  };
}


export async function getOrCreateUser(phoneNumber: string): Promise<User> {
  const supabase = createServerClient();

  const { data: existingUser, error: findError } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  if (findError && findError.code === "PGRST116") {
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({ phone_number: phoneNumber })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    return newUser as User;
  }

  throw new Error(`Failed to find user: ${findError?.message}`);
}

export async function getUserByPhone(
  phoneNumber: string
): Promise<User | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data as User;
}

export async function getUserById(userId: string): Promise<User | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data as User;
}

export async function updateUserName(
  userId: string,
  name: string
): Promise<User> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .update({ name: name.trim() })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user name: ${error.message}`);
  }

  return data as User;
}
