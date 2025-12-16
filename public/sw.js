// Service Worker for Push Notifications
const CACHE_NAME = "planning-friend-v1";

// Install event - cache essential assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(clients.claim());
});

// Push event - received a push notification
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = {
    title: "Planning Friend",
    body: "Your content is ready!",
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    url: "/dashboard",
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
      contentId: data.contentId,
    },
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
    tag: data.contentId || "general", // Prevents duplicate notifications
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event - handle user interaction
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);

  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          // Navigate existing window to the content
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline content submission
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);
});

