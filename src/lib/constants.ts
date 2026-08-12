// Session duration (7 days)
export const SESSION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

// Planner defaults
export const DEFAULT_PLANNED_TIME = "19:00"; // HH:mm for new plan items

// Share invite expiry (7 days)
export const SHARE_INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Default tags that can be suggested to users
// This file is safe to import on both client and server
export const DEFAULT_TAGS = [
  "quick",
  "slow-cooker",
  "breakfast",
  "lunch",
  "dinner",
  "appetizer",
  "dessert",
  "snack",
  "party",
  "date-night",
  "budget",
  "splurge",
  "vegetarian",
  "vegan",
  "gluten-free",
  "healthy",
  "comfort-food",
  "seasonal",
  "holiday",
  "weeknight",
  "meal-prep",
  "one-pot",
  "grilling",
  "baking",
  "no-cook",
];

// Category configuration — the single source of truth for a category's
// emoji and display label. UI icon/color tokens derive from this in
// src/lib/categories.tsx (including the ui/badge variant). Labels match what
// the cards and detail view show, so a category reads the same in the UI and
// in notifications.
export const CATEGORY_CONFIG: Record<
  string,
  { emoji: string; label: string }
> = {
  meal: { emoji: "🍽️", label: "Recipe" },
  drink: { emoji: "🍹", label: "Drink" },
  event: { emoji: "🎉", label: "Event" },
  date_idea: { emoji: "💕", label: "Date" },
  gift_idea: { emoji: "🎁", label: "Gift" },
  travel: { emoji: "✈️", label: "Travel" },
  other: { emoji: "📌", label: "Saved" },
};

// Emoji-only lookup for a category (falls back to a sparkle).
export function categoryEmoji(category: string): string {
  return CATEGORY_CONFIG[category]?.emoji ?? "✨";
}

// Deep link the note reminder uses to open the detail page with the note
// composer already open. It lives here rather than next to the push helper so
// the client page can read it without pulling web-push into the bundle.
export const NOTE_COMPOSER_PARAM = "note";
export const NOTE_COMPOSER_VALUE = "new";

