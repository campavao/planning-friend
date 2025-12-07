// TikTok video downloader with multiple fallback methods

export interface TikTokVideoInfo {
  videoUrl?: string;
  thumbnailUrl?: string;
  description: string;
  author?: string;
  originalUrl: string;
}

interface RapidAPIResponse {
  code: number;
  msg: string;
  data?: {
    play: string;
    cover: string;
    title: string;
    author: {
      nickname: string;
    };
  };
}

// Resolve short URLs to full URLs
async function resolveShortUrl(url: string): Promise<string> {
  // Check if it's a short URL
  if (
    url.includes("vm.tiktok.com") ||
    url.includes("vt.tiktok.com") ||
    url.includes("/t/")
  ) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
      });
      return response.url;
    } catch {
      // If HEAD fails, try GET
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
  return url;
}

// Extract video ID from TikTok URL
function extractVideoId(url: string): string | null {
  const videoMatch = url.match(/\/video\/(\d+)/);
  if (videoMatch) {
    return videoMatch[1];
  }
  return null;
}

// Method 1: Try RapidAPI (requires subscription)
async function tryRapidAPI(
  resolvedUrl: string
): Promise<TikTokVideoInfo | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;

  if (!rapidApiKey) {
    console.log("RAPIDAPI_KEY not set, skipping RapidAPI method");
    return null;
  }

  try {
    const response = await fetch(
      `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(
        resolvedUrl
      )}&hd=1`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": "tiktok-video-no-watermark2.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      console.log(
        `RapidAPI returned ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data: RapidAPIResponse = await response.json();

    if (data.code !== 0 || !data.data) {
      console.log(`RapidAPI error: ${data.msg}`);
      return null;
    }

    return {
      videoUrl: data.data.play,
      thumbnailUrl: data.data.cover,
      description: data.data.title || "",
      author: data.data.author?.nickname || "",
      originalUrl: resolvedUrl,
    };
  } catch (error) {
    console.log("RapidAPI method failed:", error);
    return null;
  }
}

// Method 2: Try to extract metadata from TikTok page (free fallback)
async function tryPageScrape(
  resolvedUrl: string
): Promise<TikTokVideoInfo | null> {
  try {
    const response = await fetch(resolvedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      console.log(`Page scrape returned ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Try to extract Open Graph metadata
    const ogTitle =
      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
    const ogImage =
      html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);
    const ogDescription =
      html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);

    // Try to extract from JSON-LD
    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/
    );
    let jsonLdData: {
      name?: string;
      description?: string;
      thumbnailUrl?: string[];
    } | null = null;
    if (jsonLdMatch) {
      try {
        jsonLdData = JSON.parse(jsonLdMatch[1]);
      } catch {
        // Invalid JSON, ignore
      }
    }

    const description =
      ogDescription?.[1] ||
      ogTitle?.[1] ||
      jsonLdData?.description ||
      jsonLdData?.name ||
      "";

    const thumbnailUrl =
      ogImage?.[1] || jsonLdData?.thumbnailUrl?.[0] || undefined;

    if (description || thumbnailUrl) {
      return {
        thumbnailUrl,
        description: decodeHTMLEntities(description),
        originalUrl: resolvedUrl,
      };
    }

    return null;
  } catch (error) {
    console.log("Page scrape method failed:", error);
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
    .replace(/&#x2F;/g, "/");
}

// Main function with fallbacks
export async function getTikTokVideoInfo(
  tiktokUrl: string
): Promise<TikTokVideoInfo> {
  // Resolve short URLs first
  const resolvedUrl = await resolveShortUrl(tiktokUrl);
  console.log(`Resolved URL: ${resolvedUrl}`);

  // Try RapidAPI first (best quality)
  console.log("Trying RapidAPI method...");
  const rapidApiResult = await tryRapidAPI(resolvedUrl);
  if (rapidApiResult) {
    console.log("RapidAPI method succeeded");
    return rapidApiResult;
  }

  // Fall back to page scraping
  console.log("Trying page scrape method...");
  const scrapeResult = await tryPageScrape(resolvedUrl);
  if (scrapeResult) {
    console.log("Page scrape method succeeded");
    return scrapeResult;
  }

  // Last resort: return basic info from URL
  console.log("All methods failed, using URL-only fallback");
  const videoId = extractVideoId(resolvedUrl);
  return {
    description: `TikTok video ${videoId || ""}`.trim(),
    originalUrl: resolvedUrl,
  };
}

export async function downloadTikTokVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Get video as base64 for AI processing (only if videoUrl is available)
export async function getTikTokVideoAsBase64(tiktokUrl: string): Promise<{
  base64: string;
  thumbnailUrl?: string;
  description: string;
} | null> {
  const videoInfo = await getTikTokVideoInfo(tiktokUrl);

  if (!videoInfo.videoUrl) {
    console.log("No video URL available, cannot download video");
    return null;
  }

  try {
    const videoBuffer = await downloadTikTokVideo(videoInfo.videoUrl);
    return {
      base64: videoBuffer.toString("base64"),
      thumbnailUrl: videoInfo.thumbnailUrl,
      description: videoInfo.description,
    };
  } catch (error) {
    console.log("Failed to download video:", error);
    return null;
  }
}
