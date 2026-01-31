// Service Worker for Planning Friend PWA
// Handles push notifications and static asset caching for instant loads

const CACHE_VERSION = "v2";
const STATIC_CACHE = `planning-friend-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `planning-friend-dynamic-${CACHE_VERSION}`;

// Static assets to precache for instant app shell loading
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/dashboard/planner",
  "/dashboard/gifts",
  "/dashboard/friends",
  "/dashboard/settings",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/manifest.json",
];

// Install event - precache essential assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Precaching static assets");
        // Use addAll for critical assets, but don't fail install if some are missing
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old version caches
              return (
                name.startsWith("planning-friend-") &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE
              );
            })
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests (except for CDN assets)
  if (url.origin !== location.origin && !isTrustedCDN(url)) {
    return;
  }

  // API requests - Network first with cache fallback for offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets (JS, CSS, images) - Cache first
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - Stale while revalidate for fast loads
  if (
    request.destination === "document" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default - Network with cache fallback
  event.respondWith(networkFirstWithCache(request));
});

// Check if URL is from a trusted CDN (for thumbnails, etc.)
function isTrustedCDN(url) {
  const trustedHosts = [
    "supabase.co",
    "supabase.in",
    // Add other CDNs as needed
  ];
  return trustedHosts.some((host) => url.hostname.includes(host));
}

// Check if request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  const staticExtensions = [
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
  ];
  return (
    staticExtensions.some((ext) => url.pathname.endsWith(ext)) ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image"
  );
}

// Cache-first strategy - Best for static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error("[SW] Cache-first fetch failed:", error);
    // Return offline fallback if available
    return caches.match("/") || new Response("Offline", { status: 503 });
  }
}

// Stale-while-revalidate - Best for HTML pages
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  // Start network fetch in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.warn("[SW] SWR fetch failed:", error);
      return null;
    });

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Fallback to app shell
  return caches.match("/dashboard") || caches.match("/");
}

// Network-first with cache fallback - Best for API data
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);

    // Cache successful API responses for offline use
    if (response.ok && request.url.includes("/api/")) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn("[SW] Network-first fetch failed, trying cache:", error);

    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return error response for API failures
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

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
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
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

// Message handler for cache management
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHE") {
    console.log("[SW] Clearing caches...");
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  }

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
