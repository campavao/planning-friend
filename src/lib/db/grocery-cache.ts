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

  if (error || !data) return null;
  // Rows written before the estimated/staple/checked flags existed lack them.
  return { ...data, items: normalizeCachedItems(data.items) } as CachedGroceryList;
}

/**
 * Drop every cached list for a user.
 *
 * The cache hits whenever the week still holds the same *set* of recipes, which
 * says nothing about what is inside them — so editing a recipe's ingredients
 * would otherwise keep serving the pre-edit shopping list indefinitely.
 */
export async function clearGroceryListCache(userId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("grocery_list_cache")
    .delete()
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
