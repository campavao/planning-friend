import { createServerClient } from "./client";
import type {
  Content,
  GiftAssignment,
  GiftRecipient,
  GiftRecipientWithAssignments,
} from "./types";

export async function getGiftRecipients(
  userId: string
): Promise<GiftRecipient[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_recipients")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to get gift recipients: ${error.message}`);
  }

  return data as GiftRecipient[];
}

export async function getRecipientsWithAssignments(
  userId: string
): Promise<GiftRecipientWithAssignments[]> {
  const supabase = createServerClient();

  const { data: recipients, error: recipientsError } = await supabase
    .from("gift_recipients")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (recipientsError) {
    throw new Error(`Failed to get recipients: ${recipientsError.message}`);
  }

  const recipientIds = recipients.map((r: GiftRecipient) => r.id);

  if (recipientIds.length === 0) {
    return [];
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("gift_assignments")
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .in("recipient_id", recipientIds);

  if (assignmentsError) {
    throw new Error(`Failed to get assignments: ${assignmentsError.message}`);
  }

  const assignmentsByRecipient = new Map<string, GiftAssignment[]>();
  for (const assignment of assignments || []) {
    const existing =
      assignmentsByRecipient.get(assignment.recipient_id) || [];
    existing.push(assignment as GiftAssignment);
    assignmentsByRecipient.set(assignment.recipient_id, existing);
  }

  return recipients.map((recipient: GiftRecipient) => ({
    ...recipient,
    assignments: assignmentsByRecipient.get(recipient.id) || [],
  })) as GiftRecipientWithAssignments[];
}

export async function createGiftRecipient(
  userId: string,
  name: string
): Promise<GiftRecipient> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_recipients")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create recipient: ${error.message}`);
  }

  return data as GiftRecipient;
}

export async function updateGiftRecipient(
  recipientId: string,
  name: string
): Promise<GiftRecipient> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_recipients")
    .update({ name })
    .eq("id", recipientId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update recipient: ${error.message}`);
  }

  return data as GiftRecipient;
}

export async function deleteGiftRecipient(
  recipientId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("gift_recipients")
    .delete()
    .eq("id", recipientId);

  if (error) {
    throw new Error(`Failed to delete recipient: ${error.message}`);
  }
}

export async function assignGiftToRecipient(
  recipientId: string,
  contentId: string
): Promise<GiftAssignment> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("gift_assignments")
    .insert({ recipient_id: recipientId, content_id: contentId })
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to assign gift: ${error.message}`);
  }

  return data as GiftAssignment;
}

export async function removeGiftAssignment(
  assignmentId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("gift_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    throw new Error(`Failed to remove assignment: ${error.message}`);
  }
}

export async function getGiftIdeas(userId: string): Promise<Content[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .eq("category", "gift_idea")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get gift ideas: ${error.message}`);
  }

  return data as Content[];
}
