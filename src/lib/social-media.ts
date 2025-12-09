// Unified social media handler for TikTok and Instagram

import {
    getInstagramMediaInfo,
    getInstagramVideoAsBase64,
    isInstagramUrl,
} from "./instagram";
import { getTikTokVideoAsBase64, getTikTokVideoInfo } from "./tiktok";

export type SocialPlatform = "tiktok" | "instagram" | "unknown";

export interface SocialMediaInfo {
  platform: SocialPlatform;
  videoUrl?: string;
  thumbnailUrl?: string;
  description: string;
  author?: string;
  originalUrl: string;
}

// Detect which platform a URL belongs to
export function detectPlatform(url: string): SocialPlatform {
  if (isInstagramUrl(url)) {
    return "instagram";
  }
  if (isTikTokUrl(url)) {
    return "tiktok";
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
export async function getSocialMediaInfo(url: string): Promise<SocialMediaInfo> {
  const platform = detectPlatform(url);

  switch (platform) {
    case "instagram": {
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
        thumbnailUrl: info.thumbnailUrl,
        description: info.description,
        author: info.author,
        originalUrl: info.originalUrl,
      };
    }

    default:
      return {
        platform: "unknown",
        description: "Unknown social media content",
        originalUrl: url,
      };
  }
}

// Get video as base64 for AI processing
export async function getSocialMediaVideoAsBase64(url: string): Promise<{
  base64: string;
  thumbnailUrl?: string;
  description: string;
} | null> {
  const platform = detectPlatform(url);

  switch (platform) {
    case "tiktok":
      return getTikTokVideoAsBase64(url);

    case "instagram":
      // Instagram video download requires RapidAPI
      return getInstagramVideoAsBase64(url);

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
    default:
      return "Social Media";
  }
}

