// TikTok video downloader with multiple fallback methods
// Priority: oEmbed API (free) -> Page scrape (free) -> RapidAPI (paid, optional)

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

interface OEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html: string;
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

// Method 1: Try TikTok's official oEmbed API (free, no rate limits)
async function tryOEmbed(
  resolvedUrl: string
): Promise<TikTokVideoInfo | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
      resolvedUrl
    )}`;

    const response = await fetch(oembedUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.log(`oEmbed API returned ${response.status}: ${response.statusText}`);
      return null;
    }

    const data: OEmbedResponse = await response.json();

    if (!data.title && !data.thumbnail_url) {
      console.log("oEmbed returned empty data");
      return null;
    }

    return {
      thumbnailUrl: data.thumbnail_url,
      description: data.title || "",
      author: data.author_name || "",
      originalUrl: resolvedUrl,
    };
  } catch (error) {
    console.log("oEmbed method failed:", error);
    return null;
  }
}

// Method 2: Try RapidAPI (requires subscription, provides video download)
// Only used when RAPIDAPI_KEY is set and video download is needed
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

// Method 3: Try to extract metadata from TikTok page HTML
// First tries __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON, then falls back to OG meta tags
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
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.log(`Page scrape returned ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Method 3a: Try to extract from __UNIVERSAL_DATA_FOR_REHYDRATION__ (most reliable)
    const hydrationResult = tryExtractHydrationData(html, resolvedUrl);
    if (hydrationResult) {
      console.log("Extracted data from hydration script");
      return hydrationResult;
    }

    // Method 3b: Try to extract from SIGI_STATE (alternative hydration)
    const sigiResult = tryExtractSigiState(html, resolvedUrl);
    if (sigiResult) {
      console.log("Extracted data from SIGI_STATE script");
      return sigiResult;
    }

    // Method 3c: Fall back to Open Graph metadata
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

// Extract data from TikTok's __UNIVERSAL_DATA_FOR_REHYDRATION__ script
function tryExtractHydrationData(
  html: string,
  resolvedUrl: string
): TikTokVideoInfo | null {
  try {
    // Look for the hydration script
    const hydrationMatch = html.match(
      /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );

    if (!hydrationMatch) {
      return null;
    }

    const hydrationData = JSON.parse(hydrationMatch[1]);

    // Navigate to the video data - structure may vary
    // Common paths: __DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct
    const defaultScope = hydrationData.__DEFAULT_SCOPE__;
    if (!defaultScope) {
      return null;
    }

    // Try different possible paths to video data
    const videoDetail =
      defaultScope["webapp.video-detail"] ||
      defaultScope["webapp.video_detail"];

    if (!videoDetail) {
      return null;
    }

    const itemInfo = videoDetail.itemInfo || videoDetail.itemStruct;
    const itemStruct = itemInfo?.itemStruct || itemInfo;

    if (!itemStruct) {
      return null;
    }

    // Extract the data we need
    const description = itemStruct.desc || itemStruct.description || "";
    const author =
      itemStruct.author?.nickname ||
      itemStruct.author?.uniqueId ||
      "";

    // Get cover/thumbnail - can be in different places
    const cover =
      itemStruct.video?.cover ||
      itemStruct.video?.dynamicCover ||
      itemStruct.video?.originCover ||
      "";

    if (!description && !cover) {
      return null;
    }

    return {
      thumbnailUrl: cover || undefined,
      description: decodeHTMLEntities(description),
      author,
      originalUrl: resolvedUrl,
    };
  } catch (error) {
    console.log("Failed to parse hydration data:", error);
    return null;
  }
}

// Extract data from TikTok's SIGI_STATE script (alternative format)
function tryExtractSigiState(
  html: string,
  resolvedUrl: string
): TikTokVideoInfo | null {
  try {
    // Look for SIGI_STATE script
    const sigiMatch = html.match(
      /<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/
    );

    if (!sigiMatch) {
      return null;
    }

    const sigiData = JSON.parse(sigiMatch[1]);

    // Try to find video data in ItemModule
    const itemModule = sigiData.ItemModule;
    if (!itemModule) {
      return null;
    }

    // ItemModule is keyed by video ID
    const videoIds = Object.keys(itemModule);
    if (videoIds.length === 0) {
      return null;
    }

    const videoData = itemModule[videoIds[0]];
    if (!videoData) {
      return null;
    }

    const description = videoData.desc || "";
    const author = videoData.author || "";
    const cover =
      videoData.video?.cover ||
      videoData.video?.dynamicCover ||
      "";

    if (!description && !cover) {
      return null;
    }

    return {
      thumbnailUrl: cover || undefined,
      description: decodeHTMLEntities(description),
      author,
      originalUrl: resolvedUrl,
    };
  } catch (error) {
    console.log("Failed to parse SIGI_STATE:", error);
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
// Priority: oEmbed (free) -> Page scrape (free) -> RapidAPI (paid, optional) -> URL-only
export async function getTikTokVideoInfo(
  tiktokUrl: string
): Promise<TikTokVideoInfo> {
  // Resolve short URLs first
  const resolvedUrl = await resolveShortUrl(tiktokUrl);
  console.log(`Resolved URL: ${resolvedUrl}`);

  // Try oEmbed API first (free, official, reliable)
  console.log("Trying oEmbed API method...");
  const oembedResult = await tryOEmbed(resolvedUrl);
  if (oembedResult) {
    console.log("oEmbed method succeeded");
    return oembedResult;
  }

  // Try page scraping (free, extracts from HTML)
  console.log("Trying page scrape method...");
  const scrapeResult = await tryPageScrape(resolvedUrl);
  if (scrapeResult) {
    console.log("Page scrape method succeeded");
    return scrapeResult;
  }

  // Try RapidAPI as last paid option (only if key is set)
  // This provides video download URL which free methods don't
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (rapidApiKey) {
    console.log("Trying RapidAPI method...");
    const rapidApiResult = await tryRapidAPI(resolvedUrl);
    if (rapidApiResult) {
      console.log("RapidAPI method succeeded");
      return rapidApiResult;
    }
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

// Get video as base64 for AI processing
// Note: Video download only works with RapidAPI (paid). Free methods (oEmbed, page scrape)
// return thumbnail + description which is sufficient for Gemini analysis.
export async function getTikTokVideoAsBase64(tiktokUrl: string): Promise<{
  base64: string;
  thumbnailUrl?: string;
  description: string;
} | null> {
  const videoInfo = await getTikTokVideoInfo(tiktokUrl);

  if (!videoInfo.videoUrl) {
    console.log("No video URL available (requires RapidAPI), cannot download video");
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
