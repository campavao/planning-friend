import { createServerClient } from "./client";

export interface CachedGroceryItem {
  ingredient: string;
  quantity?: string;
  category: string;
  sources: { id: string; title: string }[];
  notes?: string;
}

export interface CachedGroceryList {
  id: string;
  user_id: string;
  week_start: string;
  recipe_ids: string[];
  items: CachedGroceryItem[];
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
  return data as CachedGroceryList;
}

export async function upsertGroceryListCache(
  userId: string,
  weekStart: string,
  recipeIds: string[],
  items: CachedGroceryItem[],
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
