import {
  Calendar,
  Coffee,
  Gift,
  Heart,
  Pin,
  Plane,
  Utensils,
} from "lucide-react";
import type { ElementType } from "react";
import { CATEGORY_CONFIG } from "./constants";

/**
 * Single source of truth for how a content category is presented in the UI:
 * its lucide icon, display label, and the Tailwind color tokens. Labels come
 * from CATEGORY_CONFIG (which also carries the emoji used server-side) so a
 * category is named the same everywhere. Import this instead of re-declaring
 * per-category maps in individual components.
 */
export interface CategoryUI {
  icon: ElementType;
  label: string;
  text: string; // text-color class
  bg: string; // background class
}

export const CATEGORY_UI: Record<string, CategoryUI> = {
  meal: {
    icon: Utensils,
    label: CATEGORY_CONFIG.meal.label,
    text: "text-[var(--meal)]",
    bg: "bg-[var(--meal-bg)]",
  },
  drink: {
    icon: Coffee,
    label: CATEGORY_CONFIG.drink.label,
    text: "text-[var(--drink)]",
    bg: "bg-[var(--drink-bg)]",
  },
  event: {
    icon: Calendar,
    label: CATEGORY_CONFIG.event.label,
    text: "text-[var(--event)]",
    bg: "bg-[var(--event-bg)]",
  },
  date_idea: {
    icon: Heart,
    label: CATEGORY_CONFIG.date_idea.label,
    text: "text-[var(--date)]",
    bg: "bg-[var(--date-bg)]",
  },
  gift_idea: {
    icon: Gift,
    label: CATEGORY_CONFIG.gift_idea.label,
    text: "text-[var(--gift)]",
    bg: "bg-[var(--gift-bg)]",
  },
  travel: {
    icon: Plane,
    label: CATEGORY_CONFIG.travel.label,
    text: "text-[var(--travel)]",
    bg: "bg-[var(--travel-bg)]",
  },
  other: {
    icon: Pin,
    label: CATEGORY_CONFIG.other.label,
    text: "text-[var(--other)]",
    bg: "bg-[var(--other-bg)]",
  },
};

export function categoryUI(category: string): CategoryUI {
  return CATEGORY_UI[category] ?? CATEGORY_UI.other;
}
