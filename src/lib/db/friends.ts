import { createServerClient } from "./client";
import type { Friend } from "./types";
import { normalizePhoneNumber } from "./users";

export async function getFriends(userId: string): Promise<Friend[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("friends")
    .select("*")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to get friends: ${error.message}`);
  }

  return data as Friend[];
}

export async function addFriend(
  userId: string,
  name: string,
  phoneNumber?: string
): Promise<Friend> {
  const supabase = createServerClient();

  const normalizedPhone = phoneNumber
    ? normalizePhoneNumber(phoneNumber)
    : null;

  let linkedUserId: string | null = null;
  if (normalizedPhone) {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("phone_number", normalizedPhone)
      .single();

    if (existingUser) {
      linkedUserId = existingUser.id;
    }
  }

  const { data, error } = await supabase
    .from("friends")
    .insert({
      user_id: userId,
      name: name.trim(),
      phone_number: normalizedPhone,
      is_favorite: false,
      linked_user_id: linkedUserId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add friend: ${error.message}`);
  }

  return data as Friend;
}

export async function updateFriend(
  friendId: string,
  updates: { name?: string; is_favorite?: boolean }
): Promise<Friend> {
  const supabase = createServerClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name.trim();
  }
  if (updates.is_favorite !== undefined) {
    updateData.is_favorite = updates.is_favorite;
  }

  const { data, error } = await supabase
    .from("friends")
    .update(updateData)
    .eq("id", friendId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update friend: ${error.message}`);
  }

  return data as Friend;
}

export async function deleteFriend(
  friendId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("id", friendId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete friend: ${error.message}`);
  }
}

export async function addFriendsFromContacts(
  userId: string,
  contacts: Array<{ name: string; phoneNumber?: string }>
): Promise<Friend[]> {
  const friends: Friend[] = [];

  for (const contact of contacts) {
    try {
      const friend = await addFriend(
        userId,
        contact.name,
        contact.phoneNumber
      );
      friends.push(friend);
    } catch (error) {
      console.error(`Failed to add contact ${contact.name}:`, error);
    }
  }

  return friends;
}
