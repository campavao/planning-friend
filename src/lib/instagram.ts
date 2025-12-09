// Instagram post/reel handler with metadata extraction

export interface InstagramMediaInfo {
  videoUrl?: string;
  thumbnailUrl?: string;
  description: string;
  author?: string;
  originalUrl: string;
  mediaType: "post" | "reel" | "story" | "unknown";
}

// RapidAPI response types for Instagram Scraper API
interface RapidAPIInstagramResponse {
  data?: {
    shortcode?: string;
    caption?: string;
    video_url?: string;
    thumbnail_src?: string;
    display_url?: string;
    owner?: {
      username?: string;
      full_name?: string;
    };
    is_video?: boolean;
    // Some APIs return media array
    media?: Array<{
      video_url?: string;
      thumbnail_url?: string;
      image_url?: string;
    }>;
  };
  // Alternative response format from some APIs
  video_url?: string;
  thumbnail?: string;
  caption?: string;
  username?: string;
  graphql?: {
    shortcode_media?: {
      video_url?: string;
      display_url?: string;
      edge_media_to_caption?: {
        edges?: Array<{ node?: { text?: string } }>;
      };
      owner?: {
        username?: string;
      };
      is_video?: boolean;
    };
  };
}

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

// Method 1: Try RapidAPI Instagram Video Downloader
// Using: https://rapidapi.com/skdeveloper/api/instagram-video-downloader13
async function tryRapidAPI(
  resolvedUrl: string
): Promise<InstagramMediaInfo | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost =
    process.env.INSTAGRAM_RAPIDAPI_HOST ||
    "instagram-video-downloader13.p.rapidapi.com";

  if (!rapidApiKey) {
    console.log("RAPIDAPI_KEY not set, skipping Instagram RapidAPI method");
    return null;
  }

  try {
    console.log(`Fetching Instagram media from: ${resolvedUrl}`);

    // Instagram Video Downloader API endpoint
    const response = await fetch(
      `https://${rapidApiHost}/media?url=${encodeURIComponent(resolvedUrl)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": rapidApiHost,
        },
      }
    );

    if (!response.ok) {
      console.log(
        `Instagram RapidAPI returned ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data: RapidAPIInstagramResponse = await response.json();

    // Parse the response - handle different API response formats
    let videoUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let description = "";
    let author: string | undefined;

    // Format 1: Direct video_url/thumbnail in response
    if (data.video_url || data.thumbnail) {
      videoUrl = data.video_url;
      thumbnailUrl = data.thumbnail;
      description = data.caption || "";
      author = data.username;
    }
    // Format 2: Data object wrapper
    else if (data.data) {
      videoUrl = data.data.video_url || data.data.media?.[0]?.video_url;
      thumbnailUrl =
        data.data.thumbnail_src ||
        data.data.display_url ||
        data.data.media?.[0]?.thumbnail_url ||
        data.data.media?.[0]?.image_url;
      description = data.data.caption || "";
      author = data.data.owner?.username || data.data.owner?.full_name;
    }
    // Format 3: GraphQL response (some APIs use this)
    else if (data.graphql?.shortcode_media) {
      const media = data.graphql.shortcode_media;
      videoUrl = media.is_video ? media.video_url : undefined;
      thumbnailUrl = media.display_url;
      description =
        media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
      author = media.owner?.username;
    }

    if (!thumbnailUrl && !videoUrl && !description) {
      console.log("Instagram RapidAPI returned no usable data");
      return null;
    }

    return {
      videoUrl,
      thumbnailUrl,
      description: description || "Instagram post",
      author,
      originalUrl: resolvedUrl,
      mediaType: detectMediaType(resolvedUrl),
    };
  } catch (error) {
    console.log("Instagram RapidAPI method failed:", error);
    return null;
  }
}

// Extract metadata from Instagram page using Open Graph tags
async function tryPageScrape(
  resolvedUrl: string
): Promise<InstagramMediaInfo | null> {
  try {
    const response = await fetch(resolvedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      console.log(`Instagram page scrape returned ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract Open Graph metadata
    const ogTitle =
      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
    const ogImage =
      html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);
    const ogDescription =
      html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
    const ogVideo =
      html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:video"/);

    // Try to extract author from title (format: "Username on Instagram: ...")
    let author: string | undefined;
    const authorMatch = ogTitle?.[1]?.match(/^([^@\s]+)\s+(?:on\s+)?Instagram/i);
    if (authorMatch) {
      author = authorMatch[1];
    }

    const description =
      ogDescription?.[1] || ogTitle?.[1] || "Instagram post";
    const thumbnailUrl = ogImage?.[1] || undefined;
    const videoUrl = ogVideo?.[1] || undefined;

    if (description || thumbnailUrl) {
      return {
        videoUrl,
        thumbnailUrl,
        description: decodeHTMLEntities(description),
        author,
        originalUrl: resolvedUrl,
        mediaType: detectMediaType(resolvedUrl),
      };
    }

    return null;
  } catch (error) {
    console.log("Instagram page scrape method failed:", error);
    return null;
  }
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

  // Try RapidAPI first (best quality, can get video URLs)
  console.log("Trying Instagram RapidAPI method...");
  const rapidApiResult = await tryRapidAPI(resolvedUrl);
  if (rapidApiResult) {
    console.log("Instagram RapidAPI method succeeded");
    return rapidApiResult;
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

// Download Instagram video/image for AI processing
export async function downloadInstagramMedia(mediaUrl: string): Promise<Buffer> {
  const response = await fetch(mediaUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Instagram media: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

