import { createServerClient } from "./client";
import type { User } from "./types";
import { checkVerifyOtp, sendVerifyOtp } from "@/lib/twilio";

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

export function normalizePhoneNumber(phoneNumber: string): string {
  let normalized = phoneNumber.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else if (normalized.length === 11 && normalized.startsWith("1")) {
      normalized = "+" + normalized;
    }
  }
  return normalized;
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

export async function createVerificationCode(
  phoneNumber: string
): Promise<string> {
  const supabase = createServerClient();

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("phone_number", phoneNumber)
    .eq("used", false);

  const { error } = await supabase.from("verification_codes").insert({
    phone_number: phoneNumber,
    code,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create verification code: ${error.message}`);
  }

  return code;
}

export async function verifyCode(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("verification_codes")
    .select("*")
    .eq("phone_number", phoneNumber)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return false;
  }

  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("id", data.id);

  return true;
}
