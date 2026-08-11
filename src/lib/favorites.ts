import type { Content } from "@/lib/db/types";

/**
 * A star lives on the content row itself (see supabase/schema-favorites.sql).
 * Nothing here trusts is_favorite to be a boolean: rows fetched before that
 * migration has been applied arrive without the column.
 */
type Starrable = Pick<Content, "is_favorite">;

export function isFavorite(item: Starrable | null | undefined): boolean {
  return item?.is_favorite === true;
}

/** Starred is its own filter axis — switched off it passes everything through. */
export function filterByFavorites<T extends Starrable>(
  items: T[],
  starredOnly: boolean
): T[] {
  return starredOnly ? items.filter(isFavorite) : items;
}

/** Flip one row's star inside a cached list, leaving the other rows untouched. */
export function setFavorite<T extends Starrable & { id: string }>(
  items: T[],
  contentId: string,
  value: boolean
): T[] {
  return items.map((item) =>
    item.id === contentId ? { ...item, is_favorite: value } : item
  );
}

/**
 * Persist a star. The body carries the flag and nothing else, so starring can
 * never be mistaken for an edit that rewrites `data` or re-runs processing.
 * Resolves false when the write failed, which is the caller's cue to roll its
 * optimistic update back.
 */
export async function saveFavorite(
  contentId: string,
  value: boolean
): Promise<boolean> {
  try {
    const res = await fetch(`/api/content/${contentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
