import { createServerClient } from "./client";
import type { Content, ContentWithTags, Tag } from "./types";

export async function getUserTags(userId: string): Promise<Tag[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to get tags: ${error.message}`);
  }

  return data as Tag[];
}

export async function createTag(userId: string, name: string): Promise<Tag> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: userId, name: name.toLowerCase().trim() })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)
        .eq("name", name.toLowerCase().trim())
        .single();
      if (existing.data) return existing.data as Tag;
    }
    throw new Error(`Failed to create tag: ${error.message}`);
  }

  return data as Tag;
}

export async function deleteTag(tagId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) {
    throw new Error(`Failed to delete tag: ${error.message}`);
  }
}

export async function getContentTags(contentId: string): Promise<Tag[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content_tags")
    .select(
      `
      tag:tag_id (*)
    `
    )
    .eq("content_id", contentId);

  if (error) {
    throw new Error(`Failed to get content tags: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((ct: any) => ct.tag as Tag);
}

export async function addTagToContent(
  contentId: string,
  tagId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("content_tags")
    .insert({ content_id: contentId, tag_id: tagId });

  if (error && error.code !== "23505") {
    throw new Error(`Failed to add tag: ${error.message}`);
  }
}

export async function removeTagFromContent(
  contentId: string,
  tagId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("content_tags")
    .delete()
    .eq("content_id", contentId)
    .eq("tag_id", tagId);

  if (error) {
    throw new Error(`Failed to remove tag: ${error.message}`);
  }
}

export async function getOrCreateTags(
  userId: string,
  tagNames: string[]
): Promise<Tag[]> {
  const tags: Tag[] = [];
  for (const name of tagNames) {
    const tag = await createTag(userId, name);
    tags.push(tag);
  }
  return tags;
}

export async function addTagsToContent(
  contentId: string,
  tagIds: string[]
): Promise<void> {
  for (const tagId of tagIds) {
    await addTagToContent(contentId, tagId);
  }
}

export async function getContentWithTags(
  userId: string
): Promise<ContentWithTags[]> {
  const supabase = createServerClient();

  const { data: contentData, error: contentError } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (contentError) {
    throw new Error(`Failed to get content: ${contentError.message}`);
  }

  const contentIds = contentData.map((c: Content) => c.id);
  if (contentIds.length === 0) return [];

  const { data: tagsData, error: tagsError } = await supabase
    .from("content_tags")
    .select(
      `
      content_id,
      tag:tag_id (*)
    `
    )
    .in("content_id", contentIds);

  if (tagsError) {
    throw new Error(`Failed to get content tags: ${tagsError.message}`);
  }

  const tagsByContent = new Map<string, Tag[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ct of (tagsData || []) as any[]) {
    const existing = tagsByContent.get(ct.content_id) || [];
    existing.push(ct.tag as Tag);
    tagsByContent.set(ct.content_id, existing);
  }

  return contentData.map((content: Content) => ({
    ...content,
    tags: tagsByContent.get(content.id) || [],
  })) as ContentWithTags[];
}
