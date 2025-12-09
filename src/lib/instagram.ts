// Instagram post/reel handler with metadata extraction

export interface InstagramMediaInfo {
  videoUrl?: string;
  thumbnailUrl?: string;
  description: string;
  author?: string;
  originalUrl: string;
  mediaType: "post" | "reel" | "story" | "unknown";
}

// RapidAPI response is dynamically parsed since different APIs have different formats

// Resolve Instagram short URLs to full URLs
async function resolveShortUrl(url: string): Promise<string> {
  // Check if it's a short URL that needs resolving
  if (
    url.includes("/reel/") ||
    url.includes("/p/") ||
    url.includes("/reels/")
  ) {
    return url; // Already a full URL
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });
    return response.url;
  } catch {
    try {
      const response = await fetch(url, {
        redirect: "follow",
      });
      return response.url;
    } catch {
      return url;
    }
  }
}

// Detect media type from URL
function detectMediaType(url: string): "post" | "reel" | "story" | "unknown" {
  if (url.includes("/reel/") || url.includes("/reels/")) {
    return "reel";
  }
  if (url.includes("/p/")) {
    return "post";
  }
  if (url.includes("/stories/")) {
    return "story";
  }
  return "unknown";
}

// Method 1: Try Apify Instagram Video Downloader
// Using: https://apify.com/epctex/instagram-video-downloader
async function tryApifyAPI(
  resolvedUrl: string
): Promise<InstagramMediaInfo | null> {
  const apifyToken = process.env.APIFY_API_TOKEN;

  if (!apifyToken) {
    console.log("APIFY_API_TOKEN not set, skipping Apify method");
    return null;
  }

  try {
    // Apify Actor API - run synchronously and get dataset items
    const apiUrl = `https://api.apify.com/v2/acts/epctex~instagram-video-downloader/run-sync-get-dataset-items?token=${apifyToken}`;
    console.log(`Calling Apify Instagram API for: ${resolvedUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startUrls: [resolvedUrl],
        quality: "highest",
        compression: "none",
        proxy: {
          useApifyProxy: true,
        },
      }),
    });

    console.log(`Apify response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(
        `Apify returned ${response.status}: ${response.statusText}`,
        errorText.slice(0, 500)
      );
      return null;
    }

    const data = await response.json();
    console.log("Apify response:", JSON.stringify(data, null, 2).slice(0, 1500));

    // Apify returns an array of results
    if (!Array.isArray(data) || data.length === 0) {
      console.log("Empty response from Apify");
      return null;
    }

    const item = data[0];

    // Extract video URL and thumbnail from Apify response
    let videoUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    // Check for video URLs in the response
    if (item.videoUrl) {
      videoUrl = item.videoUrl;
    } else if (item.video) {
      videoUrl = item.video;
    } else if (item.downloadUrl) {
      videoUrl = item.downloadUrl;
    }

    // Check for thumbnail
    if (item.thumbnailUrl) {
      thumbnailUrl = item.thumbnailUrl;
    } else if (item.thumbnail) {
      thumbnailUrl = item.thumbnail;
    } else if (item.displayUrl) {
      thumbnailUrl = item.displayUrl;
    }

    const description = item.caption || item.description || item.text || "Instagram post";
    const author = item.ownerUsername || item.username || item.owner?.username;

    console.log("Parsed Apify response:", {
      hasVideoUrl: !!videoUrl,
      hasThumbnail: !!thumbnailUrl,
      author,
      descriptionPreview: description?.slice(0, 50),
    });

    if (!videoUrl && !thumbnailUrl) {
      console.log("No usable media URLs from Apify");
      return null;
    }

    return {
      videoUrl,
      thumbnailUrl,
      description,
      author,
      originalUrl: resolvedUrl,
      mediaType: detectMediaType(resolvedUrl),
    };
  } catch (error) {
    console.log(`Apify API failed:`, error);
    return null;
  }
}

// Extract metadata from Instagram page using Open Graph tags
async function tryPageScrape(
  resolvedUrl: string
): Promise<InstagramMediaInfo | null> {
  // Try multiple approaches since Instagram blocks scrapers
  const userAgents = [
    // Facebook crawler (Instagram allows this)
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    // Twitter/X crawler
    "Twitterbot/1.0",
    // Standard browser
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Mobile browser
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ];

  for (const userAgent of userAgents) {
    try {
      console.log(
        `Trying Instagram page scrape with UA: ${userAgent.slice(0, 30)}...`
      );

      const response = await fetch(resolvedUrl, {
        headers: {
          "User-Agent": userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        console.log(
          `Instagram page scrape returned ${
            response.status
          } with UA: ${userAgent.slice(0, 20)}...`
        );
        continue;
      }

      const html = await response.text();
      console.log(`Got HTML response, length: ${html.length}`);

      // Extract Open Graph metadata
      const ogTitle =
        html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
      const ogImage =
        html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);
      const ogDescription =
        html.match(
          /<meta[^>]*property="og:description"[^>]*content="([^"]*)"/
        ) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
      const ogVideo =
        html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]*)"/) ||
        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:video"/) ||
        html.match(
          /<meta[^>]*property="og:video:secure_url"[^>]*content="([^"]*)"/
        ) ||
        html.match(
          /<meta[^>]*content="([^"]*)"[^>]*property="og:video:secure_url"/
        );

      console.log("OG tags found:", {
        hasTitle: !!ogTitle,
        hasImage: !!ogImage,
        hasDescription: !!ogDescription,
        hasVideo: !!ogVideo,
      });

      // Log actual URLs for debugging
      if (ogImage?.[1]) {
        console.log("OG image URL:", ogImage[1].slice(0, 100) + "...");
      }
      if (ogVideo?.[1]) {
        console.log("OG video URL:", ogVideo[1].slice(0, 100) + "...");
      }

      // Try to extract better quality URLs from Instagram's embedded JSON data
      // Instagram embeds media data in script tags as JSON
      let betterVideoUrl: string | undefined;
      let betterThumbnailUrl: string | undefined;

      // Look for video_url in the page's JSON data
      const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
      if (videoUrlMatch) {
        // Unescape the URL (Instagram escapes forward slashes)
        betterVideoUrl = videoUrlMatch[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\\//g, "/");
        console.log(
          "Found video_url in JSON:",
          betterVideoUrl.slice(0, 100) + "..."
        );
      }

      // Look for display_url (high quality image)
      const displayUrlMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/);
      if (displayUrlMatch) {
        betterThumbnailUrl = displayUrlMatch[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\\//g, "/");
        console.log(
          "Found display_url in JSON:",
          betterThumbnailUrl.slice(0, 100) + "..."
        );
      }

      // Try to extract author from title (format: "Username on Instagram: ...")
      let author: string | undefined;
      const authorMatch = ogTitle?.[1]?.match(
        /^([^@\s]+)\s+(?:on\s+)?Instagram/i
      );
      if (authorMatch) {
        author = authorMatch[1];
      }

      // Also try to find author in description
      if (!author && ogDescription?.[1]) {
        const descAuthorMatch = ogDescription[1].match(
          /^[\d,]+\s+likes?,\s+[\d,]+\s+comments?\s+-\s+([^@\s]+)\s+on/i
        );
        if (descAuthorMatch) {
          author = descAuthorMatch[1];
        }
      }

      const description =
        ogDescription?.[1] || ogTitle?.[1] || "Instagram post";
      // Prefer JSON-extracted URLs over OG tag URLs (they work better)
      const thumbnailUrl = betterThumbnailUrl || ogImage?.[1] || undefined;
      const videoUrl = betterVideoUrl || ogVideo?.[1] || undefined;

      if (
        description &&
        description !== "Instagram" &&
        description !== "Instagram post"
      ) {
        console.log("Page scrape successful with meaningful content");
        console.log("Using thumbnail URL:", thumbnailUrl?.slice(0, 80) + "...");
        console.log("Using video URL:", videoUrl?.slice(0, 80) + "...");
        return {
          videoUrl,
          thumbnailUrl,
          description: decodeHTMLEntities(description),
          author,
          originalUrl: resolvedUrl,
          mediaType: detectMediaType(resolvedUrl),
        };
      }

      // If we got a thumbnail at least, return that
      if (thumbnailUrl) {
        console.log("Page scrape got thumbnail only");
        return {
          videoUrl,
          thumbnailUrl,
          description: decodeHTMLEntities(description),
          author,
          originalUrl: resolvedUrl,
          mediaType: detectMediaType(resolvedUrl),
        };
      }

      console.log("No useful data found with this UA, trying next...");
    } catch (error) {
      console.log(
        `Page scrape failed with UA: ${userAgent.slice(0, 20)}...`,
        error
      );
      continue;
    }
  }

  console.log("All page scrape attempts failed");
  return null;
}

// Helper to decode HTML entities
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

// Main function to get Instagram media info
export async function getInstagramMediaInfo(
  instagramUrl: string
): Promise<InstagramMediaInfo> {
  // Resolve short URLs first
  const resolvedUrl = await resolveShortUrl(instagramUrl);
  console.log(`Resolved Instagram URL: ${resolvedUrl}`);

  // Try Apify first (best quality, can get video URLs)
  console.log("Trying Apify Instagram API...");
  const apifyResult = await tryApifyAPI(resolvedUrl);
  if (apifyResult) {
    console.log("Apify Instagram API succeeded");
    return apifyResult;
  }

  // Fall back to page scraping
  console.log("Trying Instagram page scrape method...");
  const scrapeResult = await tryPageScrape(resolvedUrl);
  if (scrapeResult) {
    console.log("Instagram page scrape method succeeded");
    return scrapeResult;
  }

  // Fallback: return basic info from URL
  console.log("All Instagram methods failed, using URL-only fallback");
  const mediaType = detectMediaType(resolvedUrl);
  return {
    description: `Instagram ${mediaType}`,
    originalUrl: resolvedUrl,
    mediaType,
  };
}

// Download media with Instagram-specific headers
// Try multiple user agents since Instagram CDN is picky about who can download
export async function downloadWithInstagramHeaders(
  url: string
): Promise<Buffer> {
  console.log("Downloading Instagram media from:", url.slice(0, 100) + "...");

  // Try multiple user agents - Facebook crawler often works best
  const userAgents = [
    // Facebook crawler - same one that works for scraping
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    // Twitter bot
    "Twitterbot/1.0",
    // WhatsApp
    "WhatsApp/2.23.20.0",
    // Standard browser with Instagram referer
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ];

  for (const userAgent of userAgents) {
    try {
      console.log(`Trying download with UA: ${userAgent.slice(0, 30)}...`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          "Accept": "image/webp,image/apng,image/*,video/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      console.log(
        "Instagram media download response:",
        response.status,
        response.statusText
      );

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        console.log(
          "Downloaded Instagram media, size:",
          arrayBuffer.byteLength,
          "bytes"
        );
        return Buffer.from(arrayBuffer);
      }

      console.log(`UA ${userAgent.slice(0, 20)}... failed with ${response.status}`);
    } catch (error) {
      console.log(`UA ${userAgent.slice(0, 20)}... error:`, error);
    }
  }

  throw new Error("Failed to download media with any user agent");
}

// Download Instagram video/image for AI processing
export async function downloadInstagramMedia(mediaUrl: string): Promise<Buffer> {
  return downloadWithInstagramHeaders(mediaUrl);
}

// Get Instagram video as base64 for AI processing
export async function getInstagramVideoAsBase64(instagramUrl: string): Promise<{
  base64: string;
  thumbnailUrl?: string;
  description: string;
} | null> {
  const mediaInfo = await getInstagramMediaInfo(instagramUrl);

  if (!mediaInfo.videoUrl) {
    console.log("No Instagram video URL available, cannot download video");
    return null;
  }

  try {
    const mediaBuffer = await downloadInstagramMedia(mediaInfo.videoUrl);
    return {
      base64: mediaBuffer.toString("base64"),
      thumbnailUrl: mediaInfo.thumbnailUrl,
      description: mediaInfo.description,
    };
  } catch (error) {
    console.log("Failed to download Instagram video:", error);
    return null;
  }
}

// Check if a URL is an Instagram URL
export function isInstagramUrl(url: string): boolean {
  return /instagram\.com/i.test(url) || /instagr\.am/i.test(url);
}

// Extract Instagram media ID from URL
export function extractInstagramMediaId(url: string): string | null {
  // Match /p/MEDIA_ID or /reel/MEDIA_ID
  const match = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

