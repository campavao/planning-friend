import { createClient } from "@supabase/supabase-js";
import { checkVerifyOtp, sendVerifyOtp } from "./twilio";

// ==================== Phone Auth (OTP via Twilio Verify) ====================
// Using Twilio Verify instead of Supabase's built-in phone auth to avoid
// A2P 10DLC registration requirements. Twilio Verify uses pre-registered
// phone pools that don't require individual number registration.

// Send OTP verification code via Twilio Verify
export async function sendPhoneOtp(phoneNumber: string): Promise<void> {
  await sendVerifyOtp(phoneNumber);
}

// Verify phone OTP code via Twilio Verify
export async function verifyPhoneOtp(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; userId?: string }> {
  const result = await checkVerifyOtp(phoneNumber, code);
  return {
    success: result.success,
    // Note: We don't get a Supabase user ID since we're not using Supabase Auth
    // The app uses its own users table based on phone number
  };
}

// Normalize phone number to E.164 format
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else if (normalized.length === 11 && normalized.startsWith("1")) {
      normalized = "+" + normalized;
    }
  }

  return normalized;
}

// Types for our database
export type ContentCategory =
  | "meal"
  | "event"
  | "date_idea"
  | "gift_idea"
  | "travel"
  | "drink"
  | "other";
export type ContentStatus = "processing" | "completed" | "failed";

export interface User {
  id: string;
  phone_number: string;
  name?: string;
  created_at: string;
}

// Friends types
export interface Friend {
  id: string;
  user_id: string;
  name: string;
  phone_number?: string;
  is_favorite: boolean;
  linked_user_id?: string;
  created_at: string;
  updated_at?: string;
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
  website?: string;
  reservation_link?: string;
}

export interface DateIdeaData {
  location?: string;
  type?: "dinner" | "activity" | "entertainment" | "outdoors" | "other";
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  description?: string;
  website?: string;
  menu_link?: string;
  reservation_link?: string;
}

export interface GiftIdeaData {
  name?: string;
  cost?: string;
  purchase_link?: string;
  amazon_link?: string;
  description?: string;
}

export interface TravelData {
  location?: string;
  type?: "restaurant" | "attraction" | "hotel" | "activity" | "other";
  description?: string;
  website?: string;
  booking_link?: string;
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  destination_city?: string;
  destination_country?: string;
}

export interface DrinkData {
  recipe?: string[];
  ingredients?: string[];
  type?:
    | "cocktail"
    | "mocktail"
    | "coffee"
    | "smoothie"
    | "wine"
    | "beer"
    | "other";
  prep_time?: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface UserSettings {
  id: string;
  user_id: string;
  home_region?: string;
  home_country?: string;
  created_at: string;
  updated_at?: string;
}

// Tag types
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface ContentTag {
  id: string;
  content_id: string;
  tag_id: string;
  created_at: string;
  tag?: Tag; // Joined tag
}

export interface ContentWithTags extends Content {
  tags: Tag[];
}

export interface Content {
  id: string;
  user_id: string;
  tiktok_url: string;
  category: ContentCategory;
  title: string;
  data:
    | MealData
    | EventData
    | DateIdeaData
    | GiftIdeaData
    | TravelData
    | DrinkData
    | Record<string, unknown>;
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

// ==================== Weekly Planner ====================

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string; // ISO date string (Monday)
  created_at: string;
  updated_at?: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  content_id: string;
  day_of_week: number; // 0=Monday, 6=Sunday
  slot_order: number;
  notes?: string;
  created_at: string;
  content?: Content; // Joined content
}

export interface WeeklyPlanWithItems extends WeeklyPlan {
  items: PlanItem[];
}

// Get Monday of the current week
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

// Get or create a weekly plan
export async function getOrCreateWeeklyPlan(
  userId: string,
  weekStart: string
): Promise<WeeklyPlan> {
  const supabase = createServerClient();

  // Try to find existing plan
  const { data: existingPlan, error: findError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (existingPlan) {
    return existingPlan as WeeklyPlan;
  }

  // Create new plan
  if (findError && findError.code === "PGRST116") {
    const { data: newPlan, error: createError } = await supabase
      .from("weekly_plans")
      .insert({ user_id: userId, week_start: weekStart })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create weekly plan: ${createError.message}`);
    }

    return newPlan as WeeklyPlan;
  }

  throw new Error(`Failed to get weekly plan: ${findError?.message}`);
}

// Get weekly plan with items and content
export async function getWeeklyPlanWithItems(
  userId: string,
  weekStart: string
): Promise<WeeklyPlanWithItems | null> {
  const supabase = createServerClient();

  // Get the plan
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (planError) {
    if (planError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get weekly plan: ${planError.message}`);
  }

  // Get items with content
  const { data: items, error: itemsError } = await supabase
    .from("plan_items")
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .eq("plan_id", plan.id)
    .order("day_of_week")
    .order("slot_order");

  if (itemsError) {
    throw new Error(`Failed to get plan items: ${itemsError.message}`);
  }

  return {
    ...plan,
    items: items as PlanItem[],
  } as WeeklyPlanWithItems;
}

// Add item to plan
export async function addPlanItem(
  planId: string,
  contentId: string,
  dayOfWeek: number,
  notes?: string
): Promise<PlanItem> {
  const supabase = createServerClient();

  // Get the highest slot order for this day
  const { data: existingItems } = await supabase
    .from("plan_items")
    .select("slot_order")
    .eq("plan_id", planId)
    .eq("day_of_week", dayOfWeek)
    .order("slot_order", { ascending: false })
    .limit(1);

  const slotOrder = existingItems?.[0]?.slot_order ?? -1;

  const { data, error } = await supabase
    .from("plan_items")
    .insert({
      plan_id: planId,
      content_id: contentId,
      day_of_week: dayOfWeek,
      slot_order: slotOrder + 1,
      notes,
    })
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to add plan item: ${error.message}`);
  }

  return data as PlanItem;
}

// Remove item from plan
export async function removePlanItem(itemId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from("plan_items").delete().eq("id", itemId);

  if (error) {
    throw new Error(`Failed to remove plan item: ${error.message}`);
  }
}

// Get usage patterns for suggestions
export async function getUsagePatterns(
  userId: string
): Promise<Map<number, ContentCategory[]>> {
  const supabase = createServerClient();

  // Get all past plan items with content
  const { data, error } = await supabase
    .from("plan_items")
    .select(
      `
      day_of_week,
      content:content_id (category)
    `
    )
    .eq("plan_id.user_id", userId);

  if (error) {
    console.error("Failed to get usage patterns:", error);
    return new Map();
  }

  // Aggregate by day
  const patterns = new Map<number, ContentCategory[]>();
  for (const item of data || []) {
    const day = item.day_of_week;
    // Handle the joined content which comes as an object
    const contentData = item.content as unknown as {
      category: ContentCategory;
    } | null;
    const category = contentData?.category;
    if (category) {
      const existing = patterns.get(day) || [];
      existing.push(category);
      patterns.set(day, existing);
    }
  }

  return patterns;
}

// Get past weekly plans
export async function getPastWeeklyPlans(
  userId: string,
  limit: number = 4
): Promise<WeeklyPlan[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get past plans: ${error.message}`);
  }

  return data as WeeklyPlan[];
}

// ==================== Gift Planner ====================

export interface GiftRecipient {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface GiftAssignment {
  id: string;
  recipient_id: string;
  content_id: string;
  created_at: string;
  content?: Content; // Joined content
}

export interface GiftRecipientWithAssignments extends GiftRecipient {
  assignments: GiftAssignment[];
}

// Get all gift recipients for a user
export async function getGiftRecipients(
  userId: string
): Promise<GiftRecipient[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_recipients")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to get gift recipients: ${error.message}`);
  }

  return data as GiftRecipient[];
}

// Get recipients with their assigned gifts
export async function getRecipientsWithAssignments(
  userId: string
): Promise<GiftRecipientWithAssignments[]> {
  const supabase = createServerClient();

  const { data: recipients, error: recipientsError } = await supabase
    .from("gift_recipients")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (recipientsError) {
    throw new Error(`Failed to get recipients: ${recipientsError.message}`);
  }

  // Get all assignments with content for these recipients
  const recipientIds = recipients.map((r: GiftRecipient) => r.id);

  if (recipientIds.length === 0) {
    return [];
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("gift_assignments")
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .in("recipient_id", recipientIds);

  if (assignmentsError) {
    throw new Error(`Failed to get assignments: ${assignmentsError.message}`);
  }

  // Group assignments by recipient
  const assignmentsByRecipient = new Map<string, GiftAssignment[]>();
  for (const assignment of assignments || []) {
    const existing = assignmentsByRecipient.get(assignment.recipient_id) || [];
    existing.push(assignment as GiftAssignment);
    assignmentsByRecipient.set(assignment.recipient_id, existing);
  }

  return recipients.map((recipient: GiftRecipient) => ({
    ...recipient,
    assignments: assignmentsByRecipient.get(recipient.id) || [],
  })) as GiftRecipientWithAssignments[];
}

// Create a gift recipient
export async function createGiftRecipient(
  userId: string,
  name: string
): Promise<GiftRecipient> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_recipients")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create recipient: ${error.message}`);
  }

  return data as GiftRecipient;
}

// Update a gift recipient
export async function updateGiftRecipient(
  recipientId: string,
  name: string
): Promise<GiftRecipient> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_recipients")
    .update({ name })
    .eq("id", recipientId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update recipient: ${error.message}`);
  }

  return data as GiftRecipient;
}

// Delete a gift recipient
export async function deleteGiftRecipient(recipientId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("gift_recipients")
    .delete()
    .eq("id", recipientId);

  if (error) {
    throw new Error(`Failed to delete recipient: ${error.message}`);
  }
}

// Assign a gift to a recipient
export async function assignGiftToRecipient(
  recipientId: string,
  contentId: string
): Promise<GiftAssignment> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_assignments")
    .insert({ recipient_id: recipientId, content_id: contentId })
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to assign gift: ${error.message}`);
  }

  return data as GiftAssignment;
}

// Remove a gift assignment
export async function removeGiftAssignment(
  assignmentId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("gift_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    throw new Error(`Failed to remove assignment: ${error.message}`);
  }
}

// Get all gift ideas for a user (for the picker)
export async function getGiftIdeas(userId: string): Promise<Content[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .eq("category", "gift_idea")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get gift ideas: ${error.message}`);
  }

  return data as Content[];
}

// ==================== Tags ====================

// Re-export DEFAULT_TAGS from constants (safe for client-side imports)
export { DEFAULT_TAGS } from "./constants";

// Get all tags for a user
export async function getUserTags(userId: string): Promise<Tag[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to get tags: ${error.message}`);
  }

  return data as Tag[];
}

// Create a new tag
export async function createTag(userId: string, name: string): Promise<Tag> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: userId, name: name.toLowerCase().trim() })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique violation - tag already exists
      const existing = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)
        .eq("name", name.toLowerCase().trim())
        .single();
      if (existing.data) return existing.data as Tag;
    }
    throw new Error(`Failed to create tag: ${error.message}`);
  }

  return data as Tag;
}

// Delete a tag
export async function deleteTag(tagId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) {
    throw new Error(`Failed to delete tag: ${error.message}`);
  }
}

// Get tags for a specific content item
export async function getContentTags(contentId: string): Promise<Tag[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content_tags")
    .select(
      `
      tag:tag_id (*)
    `
    )
    .eq("content_id", contentId);

  if (error) {
    throw new Error(`Failed to get content tags: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((ct: any) => ct.tag as Tag);
}

// Add a tag to content
export async function addTagToContent(
  contentId: string,
  tagId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("content_tags")
    .insert({ content_id: contentId, tag_id: tagId });

  if (error && error.code !== "23505") {
    // Ignore duplicate
    throw new Error(`Failed to add tag: ${error.message}`);
  }
}

// Remove a tag from content
export async function removeTagFromContent(
  contentId: string,
  tagId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("content_tags")
    .delete()
    .eq("content_id", contentId)
    .eq("tag_id", tagId);

  if (error) {
    throw new Error(`Failed to remove tag: ${error.message}`);
  }
}

// Get or create multiple tags by name (for AI-suggested tags)
export async function getOrCreateTags(
  userId: string,
  tagNames: string[]
): Promise<Tag[]> {
  const tags: Tag[] = [];
  for (const name of tagNames) {
    const tag = await createTag(userId, name);
    tags.push(tag);
  }
  return tags;
}

// Add multiple tags to content
export async function addTagsToContent(
  contentId: string,
  tagIds: string[]
): Promise<void> {
  for (const tagId of tagIds) {
    await addTagToContent(contentId, tagId);
  }
}

// Get content with tags
export async function getContentWithTags(
  userId: string
): Promise<ContentWithTags[]> {
  const supabase = createServerClient();

  // Get all content
  const { data: contentData, error: contentError } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (contentError) {
    throw new Error(`Failed to get content: ${contentError.message}`);
  }

  // Get all content_tags with tag info
  const contentIds = contentData.map((c: Content) => c.id);
  if (contentIds.length === 0) return [];

  const { data: tagsData, error: tagsError } = await supabase
    .from("content_tags")
    .select(
      `
      content_id,
      tag:tag_id (*)
    `
    )
    .in("content_id", contentIds);

  if (tagsError) {
    throw new Error(`Failed to get content tags: ${tagsError.message}`);
  }

  // Group tags by content_id
  const tagsByContent = new Map<string, Tag[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ct of (tagsData || []) as any[]) {
    const existing = tagsByContent.get(ct.content_id) || [];
    existing.push(ct.tag as Tag);
    tagsByContent.set(ct.content_id, existing);
  }

  // Combine content with tags
  return contentData.map((content: Content) => ({
    ...content,
    tags: tagsByContent.get(content.id) || [],
  })) as ContentWithTags[];
}

// ==================== User Settings ====================

// Get user settings
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
    // PGRST116 is "no rows returned"
    throw new Error(`Failed to get user settings: ${error.message}`);
  }

  return data as UserSettings | null;
}

// Create or update user settings
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

// ==================== User Name ====================

// Get user by ID
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

// Update user name
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

// ==================== Friends ====================

// Get all friends for a user (sorted: favorites first, then alphabetically)
export async function getFriends(userId: string): Promise<Friend[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("friends")
    .select("*")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to get friends: ${error.message}`);
  }

  return data as Friend[];
}

// Add a friend
export async function addFriend(
  userId: string,
  name: string,
  phoneNumber?: string
): Promise<Friend> {
  const supabase = createServerClient();

  // Normalize phone number if provided
  const normalizedPhone = phoneNumber
    ? normalizePhoneNumber(phoneNumber)
    : null;

  // Check if this friend (by phone) is also a Planning Friend user
  let linkedUserId: string | null = null;
  if (normalizedPhone) {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("phone_number", normalizedPhone)
      .single();

    if (existingUser) {
      linkedUserId = existingUser.id;
    }
  }

  const { data, error } = await supabase
    .from("friends")
    .insert({
      user_id: userId,
      name: name.trim(),
      phone_number: normalizedPhone,
      is_favorite: false,
      linked_user_id: linkedUserId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add friend: ${error.message}`);
  }

  return data as Friend;
}

// Update a friend (name or favorite status)
export async function updateFriend(
  friendId: string,
  updates: { name?: string; is_favorite?: boolean }
): Promise<Friend> {
  const supabase = createServerClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name.trim();
  }
  if (updates.is_favorite !== undefined) {
    updateData.is_favorite = updates.is_favorite;
  }

  const { data, error } = await supabase
    .from("friends")
    .update(updateData)
    .eq("id", friendId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update friend: ${error.message}`);
  }

  return data as Friend;
}

// Delete a friend
export async function deleteFriend(
  friendId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("id", friendId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete friend: ${error.message}`);
  }
}

// Add multiple friends (from contacts import)
export async function addFriendsFromContacts(
  userId: string,
  contacts: Array<{ name: string; phoneNumber?: string }>
): Promise<Friend[]> {
  const friends: Friend[] = [];

  for (const contact of contacts) {
    try {
      const friend = await addFriend(userId, contact.name, contact.phoneNumber);
      friends.push(friend);
    } catch (error) {
      // Log but continue - some contacts might fail (duplicates, etc.)
      console.error(`Failed to add contact ${contact.name}:`, error);
    }
  }

  return friends;
}

// ==================== Plan Sharing ====================

export interface ShareInvite {
  id: string;
  plan_id: string;
  owner_user_id: string;
  share_code: string;
  expires_at: string;
  claimed_by_user_id?: string;
  created_at: string;
}

export interface PlanShare {
  id: string;
  plan_id: string;
  shared_with_user_id: string;
  share_code?: string;
  created_at: string;
}

// Generate a unique share code
function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create a share invite for a plan
export async function createShareInvite(
  planId: string,
  ownerUserId: string
): Promise<ShareInvite> {
  const supabase = createServerClient();

  const shareCode = generateShareCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { data, error } = await supabase
    .from("share_invites")
    .insert({
      plan_id: planId,
      owner_user_id: ownerUserId,
      share_code: shareCode,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create share invite: ${error.message}`);
  }

  return data as ShareInvite;
}

// Get share invite by code
export async function getShareInvite(
  shareCode: string
): Promise<ShareInvite | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("share_invites")
    .select("*")
    .eq("share_code", shareCode)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get share invite: ${error.message}`);
  }

  return data as ShareInvite | null;
}

// Claim a share invite (accept sharing)
export async function claimShareInvite(
  shareCode: string,
  userId: string
): Promise<PlanShare> {
  const supabase = createServerClient();

  // Get the invite
  const invite = await getShareInvite(shareCode);
  if (!invite) {
    throw new Error("Invalid share code");
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error("Share code has expired");
  }

  // Check if already claimed
  if (invite.claimed_by_user_id) {
    throw new Error("Share code has already been used");
  }

  // Can't share with yourself
  if (invite.owner_user_id === userId) {
    throw new Error("You cannot accept your own share invite");
  }

  // Create the plan share
  const { data: shareData, error: shareError } = await supabase
    .from("plan_shares")
    .insert({
      plan_id: invite.plan_id,
      shared_with_user_id: userId,
      share_code: shareCode,
    })
    .select()
    .single();

  if (shareError) {
    if (shareError.code === "23505") {
      throw new Error("You already have access to this plan");
    }
    throw new Error(`Failed to claim share invite: ${shareError.message}`);
  }

  // Mark invite as claimed
  await supabase
    .from("share_invites")
    .update({ claimed_by_user_id: userId })
    .eq("id", invite.id);

  return shareData as PlanShare;
}

// Get plans shared with user
export async function getSharedPlans(userId: string): Promise<PlanShare[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_shares")
    .select("*")
    .eq("shared_with_user_id", userId);

  if (error) {
    throw new Error(`Failed to get shared plans: ${error.message}`);
  }

  return data as PlanShare[];
}

// Extended type for shared plans with more details
export interface SharedPlanDetails {
  id: string;
  plan_id: string;
  shared_with_user_id: string;
  share_code?: string;
  created_at: string;
  owner_phone: string;
  week_start: string;
}

// Get plans shared with user with full details (including owner and week info)
export async function getSharedPlansWithDetails(
  userId: string
): Promise<SharedPlanDetails[]> {
  const supabase = createServerClient();

  // Get plan shares where user is the recipient
  const { data: planShares, error: sharesError } = await supabase
    .from("plan_shares")
    .select("*")
    .eq("shared_with_user_id", userId);

  if (sharesError) {
    throw new Error(`Failed to get shared plans: ${sharesError.message}`);
  }

  if (!planShares || planShares.length === 0) {
    return [];
  }

  // Get the plan details for each share
  const planIds = planShares.map((ps: PlanShare) => ps.plan_id);

  const { data: plans, error: plansError } = await supabase
    .from("weekly_plans")
    .select("id, user_id, week_start")
    .in("id", planIds);

  if (plansError) {
    throw new Error(`Failed to get plan details: ${plansError.message}`);
  }

  // Get owner details
  const ownerIds = [
    ...new Set(plans.map((p: { user_id: string }) => p.user_id)),
  ];
  const { data: owners, error: ownersError } = await supabase
    .from("users")
    .select("id, phone_number")
    .in("id", ownerIds);

  if (ownersError) {
    throw new Error(`Failed to get owner details: ${ownersError.message}`);
  }

  // Create lookup maps
  const planMap = new Map(
    plans.map((p: { id: string; user_id: string; week_start: string }) => [
      p.id,
      p,
    ])
  );
  const ownerMap = new Map(
    owners.map((o: { id: string; phone_number: string }) => [
      o.id,
      o.phone_number,
    ])
  );

  // Combine all the data
  return planShares.map((share: PlanShare) => {
    const plan = planMap.get(share.plan_id);
    const ownerPhone = plan ? ownerMap.get(plan.user_id) : undefined;
    return {
      ...share,
      owner_phone: ownerPhone || "Unknown",
      week_start: plan?.week_start || "",
    };
  }) as SharedPlanDetails[];
}

// Check if a specific plan is shared with anyone
export async function getPlanShareInfo(
  planId: string,
  userId: string
): Promise<{ isShared: boolean; sharedWith: string[] }> {
  const supabase = createServerClient();

  // Get the plan to check ownership
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("user_id")
    .eq("id", planId)
    .single();

  if (planError) {
    return { isShared: false, sharedWith: [] };
  }

  // Only the owner can see who they shared with
  if (plan.user_id !== userId) {
    return { isShared: false, sharedWith: [] };
  }

  // Get all shares for this plan
  const { data: shares, error: sharesError } = await supabase
    .from("plan_shares")
    .select("shared_with_user_id")
    .eq("plan_id", planId);

  if (sharesError || !shares) {
    return { isShared: false, sharedWith: [] };
  }

  if (shares.length === 0) {
    return { isShared: false, sharedWith: [] };
  }

  // Get phone numbers for shared users
  const sharedUserIds = shares.map(
    (s: { shared_with_user_id: string }) => s.shared_with_user_id
  );
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("phone_number")
    .in("id", sharedUserIds);

  if (usersError) {
    return { isShared: true, sharedWith: [] };
  }

  return {
    isShared: true,
    sharedWith: users.map((u: { phone_number: string }) => u.phone_number),
  };
}

// Remove plan share
export async function removePlanShare(
  planId: string,
  sharedWithUserId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("plan_shares")
    .delete()
    .eq("plan_id", planId)
    .eq("shared_with_user_id", sharedWithUserId);

  if (error) {
    throw new Error(`Failed to remove plan share: ${error.message}`);
  }
}

// ==================== Storage ====================

const THUMBNAILS_BUCKET = "thumbnails";

// Download image from URL and upload to Supabase Storage
export async function uploadThumbnailFromUrl(
  imageUrl: string,
  contentId: string
): Promise<string | null> {
  try {
    // Check if this is an Instagram/Facebook CDN URL (requires special handling)
    const isInstagramCdn =
      imageUrl.includes("instagram") ||
      imageUrl.includes("fbcdn") ||
      imageUrl.includes("cdninstagram");

    console.log("Downloading thumbnail from:", imageUrl.slice(0, 100) + "...");
    console.log("Is Instagram CDN:", isInstagramCdn);

    let response: Response | null = null;

    if (isInstagramCdn) {
      // Try multiple user agents for Instagram CDN
      const userAgents = [
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Twitterbot/1.0",
        "WhatsApp/2.23.20.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ];

      for (const userAgent of userAgents) {
        try {
          console.log(
            `Trying thumbnail download with UA: ${userAgent.slice(0, 30)}...`
          );
          const tryResponse = await fetch(imageUrl, {
            headers: {
              "User-Agent": userAgent,
              Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          console.log(`Thumbnail response: ${tryResponse.status}`);
          if (tryResponse.ok) {
            response = tryResponse;
            break;
          }
        } catch (e) {
          console.log(`UA ${userAgent.slice(0, 20)}... failed:`, e);
        }
      }

      if (!response) {
        console.error("Failed to download Instagram thumbnail with any UA");
        return null;
      }
    } else {
      // Standard download for non-Instagram URLs
      response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      console.log(
        "Thumbnail download response:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        console.error(`Failed to download thumbnail: ${response.status}`);
        return null;
      }
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine file extension from content type
    let extension = "jpg";
    if (contentType.includes("png")) {
      extension = "png";
    } else if (contentType.includes("webp")) {
      extension = "webp";
    } else if (contentType.includes("gif")) {
      extension = "gif";
    }

    // Upload to Supabase Storage
    const supabase = createServerClient();
    const fileName = `${contentId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error("Failed to upload thumbnail:", uploadError);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(THUMBNAILS_BUCKET)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    return null;
  }
}

// Delete thumbnail from storage
export async function deleteThumbnail(contentId: string): Promise<void> {
  const supabase = createServerClient();

  // Try to delete all possible extensions
  const extensions = ["jpg", "png", "webp", "gif"];
  const filesToDelete = extensions.map((ext) => `${contentId}.${ext}`);

  const { error } = await supabase.storage
    .from(THUMBNAILS_BUCKET)
    .remove(filesToDelete);

  if (error) {
    console.error("Failed to delete thumbnail:", error);
    // Don't throw - this is a cleanup operation
  }
}
