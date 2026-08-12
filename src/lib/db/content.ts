import { createServerClient } from "./client";
import type { Content, ContentCategory } from "./types";
import { bustAllUserWeeks } from "./suggestions";
import { getWeekStart } from "./planner";
import { clearGroceryListCache } from "./grocery-cache";

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

  const result = data as Content;

  // Bust suggestion caches when content becomes eligible (status flip to
  // completed) or when its category changes — both alter the pool.
  if (updates.status === "completed" || updates.category !== undefined) {
    bustAllUserWeeks(result.user_id, getWeekStart()).catch((err) => {
      console.error("Failed to bust suggestion cache after update:", err);
    });
  }

  // A rewritten blob can mean different ingredients, and the grocery list is
  // cached against which recipes are in the week rather than what is in them —
  // so nothing else would ever notice the edit.
  if (updates.data !== undefined) {
    clearGroceryListCache(result.user_id).catch((err) => {
      console.error("Failed to clear grocery list cache after update:", err);
    });
  }

  return result;
}

export async function saveContent(
  content: Omit<
    Content,
    "id" | "created_at" | "status" | "updated_at"
  >
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

  bustAllUserWeeks(content.user_id, getWeekStart()).catch((err) => {
    console.error("Failed to bust suggestion cache after save:", err);
  });

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

  bustAllUserWeeks(userId, getWeekStart()).catch((err) => {
    console.error("Failed to bust suggestion cache after delete:", err);
  });
}
