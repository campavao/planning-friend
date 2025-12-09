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
    // Correct endpoint format per RapidAPI docs:
    // POST /index.php with multipart/form-data
    const apiUrl = `https://${rapidApiHost}/index.php`;
    console.log(`Calling Instagram RapidAPI: POST ${apiUrl}`);
    console.log(`With URL: ${resolvedUrl}`);

    // Create FormData for multipart/form-data
    const formData = new FormData();
    formData.append("url", resolvedUrl);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": rapidApiHost,
        // Don't set Content-Type manually - fetch will set it with boundary for FormData
      },
      body: formData,
    });

    console.log(`Instagram RapidAPI response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(
        `Instagram RapidAPI returned ${response.status}: ${response.statusText}`,
        errorText.slice(0, 500)
      );
      return null;
    }

    const data = await response.json();

    // Check if response has actual data
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      console.log("Empty response from Instagram RapidAPI");
      return null;
    }

    const result = parseInstagramResponse(data, resolvedUrl);
    return result;
  } catch (error) {
    console.log(`Instagram RapidAPI failed:`, error);
    return null;
  }
}

// Parse RapidAPI response into our format
function parseInstagramResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  resolvedUrl: string
): InstagramMediaInfo | null {
  console.log("Instagram RapidAPI raw response:", JSON.stringify(data, null, 2).slice(0, 1500));

  // Check for error response first
  if (data.error === true) {
    console.log("Instagram RapidAPI error:", data.message);
    return null;
  }

  // Parse the response - handle different API response formats
  let videoUrl: string | undefined;
  let thumbnailUrl: string | undefined;
  let description = "";
  let author: string | undefined;

  // instagram-video-downloader13 exact format:
  // { "status": "success", "media": [{ "type": "video", "url": "..." }] }
  if (data.status === "success" && Array.isArray(data.media)) {
    console.log("Parsing instagram-video-downloader13 format");
    for (const item of data.media) {
      if (item.type === "video" && item.url) {
        videoUrl = item.url;
      } else if (item.type === "image" && item.url) {
        // Use image as thumbnail, or as main content if no video
        if (!thumbnailUrl) {
          thumbnailUrl = item.url;
        }
      }
      // Some responses include thumbnail separately
      if (item.thumbnail) {
        thumbnailUrl = item.thumbnail;
      }
    }
    // If we only have video, use it for thumbnail too (will be extracted as frame)
    if (videoUrl && !thumbnailUrl) {
      thumbnailUrl = videoUrl;
    }
    description = data.caption || data.title || "";
    author = data.username || data.author;
  }
  // Alternative: result array format
  else if (Array.isArray(data.result)) {
    const firstItem = data.result[0];
    if (firstItem) {
      videoUrl = firstItem.url || firstItem.video_url;
      thumbnailUrl = firstItem.thumbnail || firstItem.thumb;
    }
    description = data.title || data.caption || "";
    author = data.username || data.author;
  }
  // Direct video URL in response
  else if (data.video || data.url) {
    videoUrl = (data.video || data.url) as string;
    thumbnailUrl = (data.thumbnail || data.thumb || data.cover) as string;
    description = ((data.title || data.caption) as string) || "";
    author = (data.username || data.author) as string;
  }
  // medias array format
  else if (data.medias && Array.isArray(data.medias)) {
    const firstMedia = data.medias[0];
    if (firstMedia) {
      videoUrl = firstMedia.url;
      thumbnailUrl = firstMedia.thumbnail;
    }
    description = ((data.title || data.caption) as string) || "";
    author = data.owner?.username;
  }
  // Direct video_url/thumbnail in response
  else if (data.video_url || data.thumbnail) {
    videoUrl = data.video_url as string;
    thumbnailUrl = data.thumbnail as string;
    description = (data.caption as string) || "";
    author = data.username as string;
  }
  // Data object wrapper
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
  // GraphQL response (some APIs use this)
  else if (data.graphql?.shortcode_media) {
    const media = data.graphql.shortcode_media;
    videoUrl = media.is_video ? media.video_url : undefined;
    thumbnailUrl = media.display_url;
    description =
      media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
    author = media.owner?.username;
  }

  console.log("Parsed Instagram data:", { videoUrl: !!videoUrl, thumbnailUrl: !!thumbnailUrl, description: description?.slice(0, 50) });

  if (!thumbnailUrl && !videoUrl && !description) {
    console.log("Instagram RapidAPI returned no usable data from parsing");
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

