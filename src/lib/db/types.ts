import type { Plant } from "@/lib/plants";

export type { Plant };

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

/** Effort to cook. Deliberately the same three values as DrinkData.difficulty
 *  so a recipe and a cocktail are measured on one scale rather than two that
 *  drift apart. */
export type RecipeEffort = "easy" | "medium" | "hard";

export type SpiceLevel = "none" | "mild" | "medium" | "hot";

export interface MealData {
  recipe?: string[];
  ingredients?: string[];
  prep_time?: string;
  cook_time?: string;
  servings?: string;
  effort?: RecipeEffort;
  spice?: SpiceLevel;
  /** Appliances, bowls and utensils — checkable while cooking. */
  equipment?: string[];
  /** Distinct plants this recipe contributes, keyed by source organism.
   *  See src/lib/plants.ts for why this is a list and not a count. */
  plants?: Plant[];
  /** Owner-defined extra rows. */
  sections?: CustomSection[];
}

/**
 * A row the owner added themselves, for the things no extraction will ever
 * guess. Free-form on purpose: a label and a value is enough structure.
 */
export interface CustomSection {
  label: string;
  value: string;
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
  image_url?: string;
  /** Ticketed events nearly always carry one, so it is a real field rather
   *  than something the owner has to add as a custom section. */
  seats?: string;
  sections?: CustomSection[];
}

export interface DateIdeaData {
  location?: string;
  type?: "dinner" | "activity" | "entertainment" | "outdoors" | "other";
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  description?: string;
  website?: string;
  menu_link?: string;
  reservation_link?: string;
  image_url?: string;
  sections?: CustomSection[];
}

export interface GiftIdeaData {
  name?: string;
  cost?: string;
  purchase_link?: string;
  amazon_link?: string;
  description?: string;
  sections?: CustomSection[];
}

export interface TravelData {
  location?: string;
  type?: "restaurant" | "attraction" | "hotel" | "activity" | "other";
  /** When the trip or stay starts — check-in, or departure. Free-form, the
   *  same as an event's, and read by the same parser. */
  date?: string;
  /** When it ends — check-out, or the return. A stay shows on every day
   *  between the two in the planner. */
  end_date?: string;
  description?: string;
  website?: string;
  booking_link?: string;
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  destination_city?: string;
  destination_country?: string;
  image_url?: string;
  sections?: CustomSection[];
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
  difficulty?: RecipeEffort;
  equipment?: string[];
  sections?: CustomSection[];
}

export interface UserSettings {
  id: string;
  user_id: string;
  home_region?: string;
  home_country?: string;
  // Optional for the same reason as Content.is_favorite: rows read before
  // schema-item-notes.sql has been applied come back without these columns.
  // resolveNoteReminderSettings() supplies the defaults.
  note_reminders_enabled?: boolean;
  note_reminder_delay_minutes?: number;
  /** IANA name, reported by the browser. Absent until it has been, in which
   *  case everything that needs a real moment falls back to UTC. */
  timezone?: string;
  created_at: string;
  updated_at?: string;
}

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
  tag?: Tag;
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
  // Optional rather than boolean: rows read before schema-favorites.sql has
  // been applied come back without the column at all.
  is_favorite?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ContentWithTags extends Content {
  tags: Tag[];
}

export interface VerificationCode {
  id: string;
  phone_number: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string;
  created_at: string;
  updated_at?: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  content_id?: string;
  planned_date: string;
  slot_order: number;
  notes?: string;
  note_title?: string;
  // Stamped by the note-reminder cron. Optional because rows read before
  // schema-item-notes.sql has been applied lack the column entirely.
  note_reminder_sent_at?: string | null;
  created_at: string;
  content?: Content;
}

/**
 * A review of the item itself, written after the fact — distinct from
 * PlanItem.notes, which is a planning note on one scheduled occurrence.
 * Many per item: the value is in comparing across repeat visits.
 */
export interface ItemNote {
  id: string;
  content_id: string;
  user_id: string;
  body: string;
  rating?: number | null;
  plan_item_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** A note joined to the occasion it came from, when it was tied to one. */
export interface ItemNoteWithOccasion extends ItemNote {
  occasion?: {
    id: string;
    planned_date: string;
    note_title?: string | null;
  } | null;
}

export interface WeeklyPlanWithItems extends WeeklyPlan {
  items: PlanItem[];
}

export interface GiftRecipient {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface GiftAssignment {
  id: string;
  recipient_id: string;
  /** Null when the gift is a quick note rather than a saved item. */
  content_id: string | null;
  /** Free-text gift, set instead of content_id (see schema-gift-notes.sql). */
  note_title?: string | null;
  created_at: string;
  given_at?: string | null;
  content?: Content | null;
}

export interface GiftRecipientWithAssignments extends GiftRecipient {
  assignments: GiftAssignment[];
}

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

export interface SharedPlanDetails {
  id: string;
  plan_id: string;
  shared_with_user_id: string;
  share_code?: string;
  created_at: string;
  owner_phone: string;
  week_start: string;
}

export interface PlanItemShare {
  id: string;
  plan_item_id: string;
  owner_user_id: string;
  shared_with_user_id: string;
  created_at: string;
}

export interface SharedPlanItem extends PlanItem {
  owner_user_id: string;
  owner_name?: string;
  shared_date: string;
  is_shared: true;
}

export interface PlanItemWithSharing extends PlanItem {
  is_shared?: boolean;
  is_owner?: boolean;
  owner_name?: string;
  shared_with?: { id: string; name: string }[];
}
