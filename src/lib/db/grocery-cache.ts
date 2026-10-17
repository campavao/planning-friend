import { normalizeCachedItems, type GroceryItem } from "../grocery-list";
import { createServerClient } from "./client";

/**
 * A row of `grocery_list_cache`: the latest grocery list for one user's week.
 *
 * `items` is the final list, check-off state included (see GroceryItem).
 * `recipe_ids` is the cache key from groceryCacheKey: content ids plus
 * `note:<title>` entries for quick notes.
 */
export interface CachedGroceryList {
  id: string;
  user_id: string;
  week_start: string;
  recipe_ids: string[];
  items: GroceryItem[];
  tips: string[];
  created_at: string;
  updated_at: string;
}

export async function getGroceryListCache(
  userId: string,
  weekStart: string
): Promise<CachedGroceryList | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("grocery_list_cache")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  // No row yet is the only "nothing cached". Any other failure throws: a
  // caller that took it for a miss would regenerate and upsert over the row,
  // wiping the week's check-offs.
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to read grocery list cache: ${error.message}`);
  }
  if (!data) return null;
  // Rows written before the estimated/staple/checked flags existed lack them.
  return { ...data, items: normalizeCachedItems(data.items) } as CachedGroceryList;
}

/**
 * Mark every cached list for a user as stale.
 *
 * The cache hits whenever the week still holds the same *set* of recipes, which
 * says nothing about what is inside them — so editing a recipe's ingredients
 * would otherwise keep serving the pre-edit shopping list indefinitely.
 *
 * The rows are kept and only their key is emptied: the items hold the user's
 * check-offs, and the next generation carries them over from the stale row.
 * An empty key never matches, because a week with no meals is never cached.
 */
export async function clearGroceryListCache(userId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("grocery_list_cache")
    .update({ recipe_ids: [] })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to clear grocery list cache: ${error.message}`);
  }
}

export async function upsertGroceryListCache(
  userId: string,
  weekStart: string,
  recipeIds: string[],
  items: GroceryItem[],
  tips: string[]
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("grocery_list_cache").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      recipe_ids: recipeIds,
      items,
      tips,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" }
  );

  if (error) {
    throw new Error(`Failed to cache grocery list: ${error.message}`);
  }
}

/** Replace the items of an existing cached list, leaving its key and tips alone. */
export async function updateGroceryListItems(
  userId: string,
  weekStart: string,
  items: GroceryItem[]
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("grocery_list_cache")
    .update({ items, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (error) {
    throw new Error(`Failed to update grocery list: ${error.message}`);
  }
}
