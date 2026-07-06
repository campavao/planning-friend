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
// emoji, display label, and badge class. UI icon/color tokens derive from
// this in src/lib/categories.tsx. Labels match what the cards and detail
// view show, so a category reads the same in the UI and in notifications.
export const CATEGORY_CONFIG: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  meal: { emoji: "🍽️", label: "Recipe", color: "badge-meal" },
  drink: { emoji: "🍹", label: "Drink", color: "badge-drink" },
  event: { emoji: "🎉", label: "Event", color: "badge-event" },
  date_idea: { emoji: "💕", label: "Date", color: "badge-date_idea" },
  gift_idea: { emoji: "🎁", label: "Gift", color: "badge-gift_idea" },
  travel: { emoji: "✈️", label: "Travel", color: "badge-travel" },
  other: { emoji: "📌", label: "Saved", color: "badge-other" },
};

// Emoji-only lookup for a category (falls back to a sparkle).
export function categoryEmoji(category: string): string {
  return CATEGORY_CONFIG[category]?.emoji ?? "✨";
}

