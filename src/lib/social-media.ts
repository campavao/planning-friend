// Unified social media handler for TikTok, Instagram, and websites

import {
  getInstagramMediaInfo,
  getInstagramVideoAsBase64,
  isInstagramUrl,
} from "./instagram";
import { getTikTokVideoAsBase64, getTikTokVideoInfo } from "./tiktok";
import { downloadExtractedVideo, tryExtractor } from "./extractor";
import { getWebsiteInfo, isGenericWebsiteUrl } from "./website";

export type SocialPlatform = "tiktok" | "instagram" | "website" | "unknown";

export interface SocialMediaInfo {
  platform: SocialPlatform;
  videoUrl?: string;
  /** Headers required to fetch `videoUrl`. See TikTokVideoInfo.videoHeaders. */
  videoHeaders?: Record<string, string>;
  /** Slides of a photo post, in order. Set instead of videoUrl. */
  imageUrls?: string[];
  /** Headers required to fetch `imageUrls`. */
  imageHeaders?: Record<string, string>;
  thumbnailUrl?: string;
  description: string;
  author?: string;
  originalUrl: string;
  // Website-specific fields
  pageContent?: string;
  structuredData?: Record<string, unknown>;
  siteName?: string;
  resolvedUrl?: string;
}

// Detect which platform a URL belongs to
export function detectPlatform(url: string): SocialPlatform {
  if (isInstagramUrl(url)) {
    return "instagram";
  }
  if (isTikTokUrl(url)) {
    return "tiktok";
  }
  if (isGenericWebsiteUrl(url)) {
    return "website";
  }
  return "unknown";
}

// Check if a URL is a TikTok URL
export function isTikTokUrl(url: string): boolean {
  return (
    /tiktok\.com/i.test(url) ||
    /vm\.tiktok\.com/i.test(url) ||
    /vt\.tiktok\.com/i.test(url)
  );
}

// Get media info from any supported platform
export async function getSocialMediaInfo(
  url: string
): Promise<SocialMediaInfo> {
  const platform = detectPlatform(url);

  switch (platform) {
    case "instagram": {
      // yt-dlp handles live reels directly, so try our own extractor before
      // paying Apify for the same thing. Reels were the case Apify was really
      // being bought for; carousels still fall through to it, because those
      // render client-side and need a browser the extractor does not have.
      //
      // The earlier belief that Instagram required an authenticated session
      // came from a probe sample that had been deleted — there is no login
      // wall on a live post.
      const extracted = await tryExtractor(url);
      if (extracted) {
        console.log("Self-hosted extractor handled Instagram");
        return {
          platform: "instagram",
          videoUrl: extracted.videoUrl,
          videoHeaders: extracted.videoHeaders,
          imageUrls: extracted.imageUrls,
          imageHeaders: extracted.imageHeaders,
          thumbnailUrl: extracted.thumbnailUrl,
          description: extracted.description,
          author: extracted.author,
          originalUrl: extracted.originalUrl,
        };
      }

      const info = await getInstagramMediaInfo(url);
      return {
        platform: "instagram",
        videoUrl: info.videoUrl,
        thumbnailUrl: info.thumbnailUrl,
        description: info.description,
        author: info.author,
        originalUrl: info.originalUrl,
      };
    }

    case "tiktok": {
      const info = await getTikTokVideoInfo(url);
      return {
        platform: "tiktok",
        videoUrl: info.videoUrl,
        videoHeaders: info.videoHeaders,
        imageUrls: info.imageUrls,
        imageHeaders: info.imageHeaders,
        thumbnailUrl: info.thumbnailUrl,
        description: info.description,
        author: info.author,
        originalUrl: info.originalUrl,
      };
    }

    case "website": {
      const info = await getWebsiteInfo(url);
      return {
        platform: "website",
        thumbnailUrl: info.thumbnailUrl,
        description: info.description || info.title || "Website content",
        originalUrl: url,
        pageContent: info.pageContent,
        structuredData: info.structuredData,
        siteName: info.siteName,
        resolvedUrl: info.resolvedUrl,
      };
    }

    default:
      return {
        platform: "unknown",
        description: "Unknown content",
        originalUrl: url,
      };
  }
}

// Get video as base64 for AI processing
// `prefetched` is the SocialMediaInfo the caller already resolved. Passing it
// avoids running the whole platform lookup a second time just to reach the
// video URL it already contains — a duplicate yt-dlp run on TikTok, and a
// duplicate billed Apify run on Instagram.
export async function getSocialMediaVideoAsBase64(
  url: string,
  prefetched?: SocialMediaInfo
): Promise<{
  base64: string;
  thumbnailUrl?: string;
  description: string;
} | null> {
  // Anything our own extractor resolved downloads the same way whatever
  // platform it came from — the URL points at our endpoint and carries its
  // auth in videoHeaders. Checking this before the platform switch is what
  // lets an Instagram reel use the extractor instead of falling to Apify.
  if (prefetched?.videoUrl && prefetched.videoHeaders) {
    try {
      const buffer = await downloadExtractedVideo(
        prefetched.videoUrl,
        prefetched.videoHeaders
      );
      return {
        base64: buffer.toString("base64"),
        thumbnailUrl: prefetched.thumbnailUrl,
        description: prefetched.description,
      };
    } catch (error) {
      console.log("Extractor video download failed:", error);
      return null;
    }
  }

  const platform = detectPlatform(url);

  switch (platform) {
    case "tiktok":
      return getTikTokVideoAsBase64(url, prefetched);

    case "instagram":
      return getInstagramVideoAsBase64(url, prefetched);

    default:
      return null;
  }
}

// Extract social media URL from text (supports both TikTok and Instagram)
export function extractSocialMediaUrl(text: string): {
  url: string;
  platform: SocialPlatform;
} | null {
  // TikTok patterns
  const tiktokPatterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi,
    /https?:\/\/(?:vm|vt)\.tiktok\.com\/[\w]+/gi,
    /https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w]+/gi,
  ];

  // Instagram patterns
  const instagramPatterns = [
    // Reels
    /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels)\/[\w-]+\/?/gi,
    // Posts
    /https?:\/\/(?:www\.)?instagram\.com\/p\/[\w-]+\/?/gi,
    // Stories (limited support)
    /https?:\/\/(?:www\.)?instagram\.com\/stories\/[\w.-]+\/\d+\/?/gi,
    // Short URLs
    /https?:\/\/instagr\.am\/[\w-]+\/?/gi,
  ];

  // Check TikTok patterns first
  for (const pattern of tiktokPatterns) {
    const match = text.match(pattern);
    if (match) {
      return { url: match[0], platform: "tiktok" };
    }
  }

  // Check Instagram patterns
  for (const pattern of instagramPatterns) {
    const match = text.match(pattern);
    if (match) {
      return { url: match[0], platform: "instagram" };
    }
  }

  return null;
}

// Get a friendly name for the platform
export function getPlatformDisplayName(platform: SocialPlatform): string {
  switch (platform) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "website":
      return "Website";
    default:
      return "Content";
  }
}
