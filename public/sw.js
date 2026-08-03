// Service Worker for Planning Friend PWA
// Handles push notifications and static asset caching for instant loads

// v3: HTML pages are no longer precached and auth/RSC traffic never touches
// the cache. Bumping the version drops the poisoned v2 entries (see below).
const CACHE_VERSION = "v3";
const STATIC_CACHE = `planning-friend-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `planning-friend-dynamic-${CACHE_VERSION}`;

// Icons and the manifest only. HTML pages are deliberately NOT precached:
// every /dashboard route redirects to the login page while signed out, so
// precaching them stores the login page — as a `redirected` response — under
// the dashboard's cache key. Replaying a redirected response for a navigation
// is a hard failure (navigations use redirect mode "manual"), so the tap that
// should have opened the dashboard silently does nothing.
const STATIC_ASSETS = [
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

  // Auth and navigation payloads go straight to the network, untouched: a
  // cached session answer or a cached redirect breaks sign-in in ways that
  // only clear when the app is force-quit.
  if (isAuthRequest(url) || isRscRequest(request, url)) {
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

  // HTML pages - Network first. These carry the signed-in/signed-out decision
  // and the current build's script tags, so cache is an offline fallback only.
  if (isDocumentRequest(request)) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Default - Network with cache fallback
  event.respondWith(networkFirstWithCache(request));
});

// Session state must never be read from a cache — stale either way logs the
// user into the wrong state.
function isAuthRequest(url) {
  return url.pathname.startsWith("/api/auth/");
}

// Next.js client-side navigations. Their responses encode a specific build and
// route tree, and middleware may answer with a redirect.
function isRscRequest(request, url) {
  return request.headers.has("rsc") || url.searchParams.has("_rsc");
}

function isDocumentRequest(request) {
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.headers.get("accept")?.includes("text/html")
  );
}

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
    return new Response("Offline", { status: 503 });
  }
}

// Network-first for HTML pages, cache used only when the network is gone.
async function networkFirstDocument(request) {
  const cache = await caches.open(DYNAMIC_CACHE);

  try {
    const response = await fetch(request);

    // Only store real, final pages. A redirect (the signed-out bounce from
    // /dashboard to /) must never be cached: replaying it for a navigation is
    // rejected by the browser and the navigation dies silently.
    if (response.ok && !response.redirected) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn("[SW] Document fetch failed, trying cache:", error);

    const cached = await cache.match(request);
    if (cached && !cached.redirected) {
      return cached;
    }

    return new Response(OFFLINE_PAGE, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8f3ed;color:#4a4a4a;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
p{max-width:20rem;line-height:1.5}</style></head>
<body><p><strong>You're offline.</strong><br>Reconnect and reopen Planning Friend.</p></body></html>`;

// Network-first with cache fallback - Best for API data
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);

    // Cache successful API responses for offline use. Redirects are skipped
    // for the same reason as documents, and /api/auth/* never reaches here.
    if (response.ok && !response.redirected && request.url.includes("/api/")) {
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
