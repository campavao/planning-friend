import { createClient } from "@supabase/supabase-js";

// Types for our database
export type ContentCategory = "meal" | "event" | "date_idea" | "other";
export type ContentStatus = "processing" | "completed" | "failed";

export interface User {
  id: string;
  phone_number: string;
  created_at: string;
}

export interface MealData {
  recipe?: string[];
  ingredients?: string[];
  prep_time?: string;
  cook_time?: string;
  servings?: string;
}

export interface EventData {
  location?: string;
  date?: string;
  time?: string;
  requires_reservation?: boolean;
  requires_ticket?: boolean;
  ticket_link?: string;
  description?: string;
}

export interface DateIdeaData {
  location?: string;
  type?: "dinner" | "activity" | "entertainment" | "outdoors" | "other";
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  description?: string;
}

export interface Content {
  id: string;
  user_id: string;
  tiktok_url: string;
  category: ContentCategory;
  title: string;
  data: MealData | EventData | DateIdeaData | Record<string, unknown>;
  thumbnail_url?: string;
  status: ContentStatus;
  created_at: string;
  updated_at?: string;
}

export interface VerificationCode {
  id: string;
  phone_number: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

// Client for browser/client-side operations (uses anon key)
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Client for server-side operations (uses service role key for full access)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper functions for common operations
export async function getOrCreateUser(phoneNumber: string): Promise<User> {
  const supabase = createServerClient();

  // First try to find existing user
  const { data: existingUser, error: findError } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  // If not found, create new user
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
      return null; // Not found
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data as User;
}

// Create content with processing status
export async function createProcessingContent(
  userId: string,
  tiktokUrl: string
): Promise<Content> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .insert({
      user_id: userId,
      tiktok_url: tiktokUrl,
      category: "other",
      title: "Processing...",
      data: {},
      status: "processing",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create content: ${error.message}`);
  }

  return data as Content;
}

// Update content after processing
export async function updateContent(
  contentId: string,
  updates: Partial<Omit<Content, "id" | "created_at" | "user_id">>
): Promise<Content> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update content: ${error.message}`);
  }

  return data as Content;
}

// Legacy save function (for backwards compatibility)
export async function saveContent(
  content: Omit<Content, "id" | "created_at" | "status" | "updated_at">
): Promise<Content> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .insert({
      ...content,
      status: "completed",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save content: ${error.message}`);
  }

  return data as Content;
}

export async function getContentById(
  contentId: string
): Promise<Content | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("id", contentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get content: ${error.message}`);
  }

  return data as Content;
}

export async function getContentByUser(userId: string): Promise<Content[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get content: ${error.message}`);
  }

  return data as Content[];
}

export async function getContentByCategory(
  userId: string,
  category: ContentCategory
): Promise<Content[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get content: ${error.message}`);
  }

  return data as Content[];
}

export async function deleteContent(
  contentId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("content")
    .delete()
    .eq("id", contentId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete content: ${error.message}`);
  }
}

// Verification code helpers
export async function createVerificationCode(
  phoneNumber: string
): Promise<string> {
  const supabase = createServerClient();

  // Generate a 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Set expiration to 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Invalidate any existing codes for this phone number
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("phone_number", phoneNumber)
    .eq("used", false);

  // Create new code
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

  // Mark code as used
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("id", data.id);

  return true;
}
