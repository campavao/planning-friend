import { describeAttributes, type ItemAttribute } from "@/lib/attributes";
import { displayPrice } from "@/lib/price";
import { shortDuration } from "@/lib/short-duration";
import type { Content, PlanItem } from "@/lib/supabase";

/**
 * What a planner card shows once it is expanded.
 *
 * The collapsed card is a title and a time — enough to read the week at a
 * glance, not enough to answer "what do I need for this?" without leaving the
 * planner. Expanding pulls the handful of fields that answer that question out
 * of `data`, so a day can be checked without a trip to the detail page and back.
 *
 * Everything is optional, for the same reason as the attribute chips: an item
 * extracted before a field existed renders nothing rather than a placeholder.
 */
export interface PlanItemDetails {
  attributes: ItemAttribute[];
  /** "Sat, Aug 23 · 7pm" for events; "Aug 23 → Aug 27" for a stay. */
  when?: string;
  location?: string;
  /** "Prep 10 min", "Cook 20 min", "Serves 4". */
  timings: string[];
  ingredients: string[];
  /** Ingredients past the first few, which the card counts instead of lists. */
  moreIngredients: number;
  description?: string;
  /** The planning note on this one occurrence, not a review of the item. */
  note?: string;
}

/** Enough to jog a memory; the full list is one tap away on the detail page. */
const MAX_INGREDIENTS = 6;

type AnyData = Record<string, unknown>;

function str(data: AnyData, field: string): string | undefined {
  const value = data[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** A duration field, shortened for a card: "15 minutes" reads "15 min". */
function duration(data: AnyData, field: string): string | undefined {
  const value = str(data, field);
  return value && shortDuration(value);
}

function strings(data: AnyData, field: string): string[] {
  const value = data[field];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && !!entry.trim(),
  );
}

export function planItemDetails(item: PlanItem): PlanItemDetails {
  const note = item.notes?.trim() || undefined;
  const content = item.content;

  if (!content) {
    return { attributes: [], timings: [], ingredients: [], moreIngredients: 0, note };
  }

  const data = (content.data ?? {}) as AnyData;
  const category = content.category;

  let when: string | undefined;
  if (category === "event") {
    when = [str(data, "date"), str(data, "time")].filter(Boolean).join(" · ");
  } else if (category === "travel") {
    const start = str(data, "date");
    const end = str(data, "end_date");
    when = start && end ? `${start} → ${end}` : start;
  }

  const timings: string[] = [];
  if (category === "meal" || category === "drink") {
    const prep = duration(data, "prep_time");
    const cook = duration(data, "cook_time");
    const servings = str(data, "servings");
    if (prep) timings.push(`Prep ${prep}`);
    if (cook) timings.push(`Cook ${cook}`);
    if (servings) timings.push(`Serves ${servings}`);
  }

  const allIngredients =
    category === "meal" || category === "drink"
      ? strings(data, "ingredients")
      : [];

  return {
    // A drink's prep time already reads in the timings row; showing it as a
    // chip as well would say the same thing twice an inch apart.
    attributes: describeAttributes(category, data).filter(
      (attribute) => !(category === "drink" && attribute.key === "prep"),
    ),
    when: when || undefined,
    location: str(data, "location"),
    timings,
    ingredients: allIngredients.slice(0, MAX_INGREDIENTS),
    moreIngredients: Math.max(0, allIngredients.length - MAX_INGREDIENTS),
    description: str(data, "description"),
    note,
  };
}

/**
 * The one line a closed planner card carries under its title — the fact you'd
 * otherwise open the card for. Cook time for a recipe, the venue for an event,
 * where a trip goes, what a gift costs. Two facts at most: it is one line on a
 * phone, and a third would only ever be truncated.
 */
export function planItemMeta(item: PlanItem): string | undefined {
  return item.content ? contentMeta(item.content) : undefined;
}

/** planItemMeta for a saved item on its own — the home page's collection row. */
export function contentMeta(content: Content): string | undefined {
  const data = (content.data ?? {}) as AnyData;

  const parts: (string | undefined)[] = (() => {
    switch (content.category) {
      case "meal":
      case "drink": {
        const prep = duration(data, "prep_time");
        const cook = duration(data, "cook_time");
        const servings = str(data, "servings");
        return [
          prep && `${prep} prep`,
          cook && `${cook} cook`,
          servings && `Serves ${servings}`,
        ];
      }
      // Not the event's own time: the card's time chip already shows when
      // it's planned, and the two read as a duplicate side by side.
      case "event":
        return [str(data, "location") ?? str(data, "date")];
      case "date_idea":
        return [str(data, "location"), displayPrice(data.price_range)];
      case "travel": {
        const city = str(data, "destination_city");
        return [city ?? str(data, "location"), displayPrice(data.price_range)];
      }
      case "gift_idea":
        return [displayPrice(data.cost)];
      default:
        return [];
    }
  })();

  const present = parts.filter((part): part is string => !!part).slice(0, 2);
  return present.length ? present.join(" · ") : undefined;
}
