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

// Category configuration
export const CATEGORY_CONFIG: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  meal: { emoji: "🍽️", label: "Meal", color: "badge-meal" },
  drink: { emoji: "🍹", label: "Drink", color: "badge-drink" },
  event: { emoji: "🎉", label: "Event", color: "badge-event" },
  date_idea: { emoji: "💕", label: "Date Idea", color: "badge-date_idea" },
  gift_idea: { emoji: "🎁", label: "Gift Idea", color: "badge-gift_idea" },
  travel: { emoji: "✈️", label: "Travel", color: "badge-travel" },
  other: { emoji: "📌", label: "Saved", color: "badge-other" },
};

// Category emojis for quick lookup
export const CATEGORY_EMOJI: Record<string, string> = {
  meal: "🍽️",
  drink: "🍹",
  event: "🎉",
  date_idea: "💕",
  gift_idea: "🎁",
  travel: "✈️",
  other: "📌",
};

