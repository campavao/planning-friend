import webpush from "web-push";
import { createServerClient } from "./supabase";

// Configure web-push with VAPID keys
// You'll need to set these environment variables:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY - the public key (shared with client)
// VAPID_PRIVATE_KEY - the private key (server only)
// VAPID_EMAIL - contact email for push service

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || "mailto:hello@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  contentId?: string;
  category?: string;
}

/**
 * Save a push subscription for a user
 */
export async function savePushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }
): Promise<PushSubscription> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,endpoint",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving push subscription:", error);
    throw error;
  }

  return data;
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("Error removing push subscription:", error);
    throw error;
  }
}

/**
 * Get all push subscriptions for a user
 */
export async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error getting push subscriptions:", error);
    throw error;
  }

  return data || [];
}

/**
 * Send a push notification to a specific subscription
 */
async function sendToSubscription(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notification");
    return false;
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    console.log(
      "Push notification sent successfully to:",
      subscription.endpoint.slice(0, 50)
    );
    return true;
  } catch (error: unknown) {
    console.error("Error sending push notification:", error);

    const errorCode = (error as { statusCode?: number })?.statusCode;

    // If the subscription is no longer valid, remove it
    if (errorCode === 410 || errorCode === 404) {
      console.log("Subscription expired, removing...");
      await removePushSubscription(subscription.user_id, subscription.endpoint);
    }

    return false;
  }
}

/**
 * Send a push notification to all devices for a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await getUserPushSubscriptions(userId);

  if (subscriptions.length === 0) {
    console.log("No push subscriptions found for user:", userId);
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.all(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  );

  const sent = results.filter(Boolean).length;
  const failed = results.length - sent;

  console.log(
    `Push notifications: ${sent} sent, ${failed} failed for user ${userId}`
  );
  return { sent, failed };
}

/**
 * Send a notification when content processing is complete
 */
export async function notifyContentReady(
  userId: string,
  contentId: string,
  title: string,
  category: string
): Promise<void> {
  const categoryEmojis: Record<string, string> = {
    meal: "🍽️",
    drink: "🍹",
    event: "🎉",
    date_idea: "💕",
    gift_idea: "🎁",
    travel: "✈️",
    other: "📌",
  };

  const emoji = categoryEmojis[category] || "✨";

  await sendPushNotification(userId, {
    title: `${emoji} Content Saved!`,
    body: title,
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    url: `/dashboard/${contentId}`,
    contentId,
    category,
  });
}

/**
 * Check if push notifications are properly configured
 */
export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

/**
 * Get the public VAPID key for client-side subscription
 */
export function getPublicVapidKey(): string | null {
  return vapidPublicKey || null;
}
