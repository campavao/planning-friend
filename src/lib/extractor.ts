/**
 * Client for the self-hosted extractor (`api/extract.py`, PLA-15).
 *
 * Lives here rather than inside tiktok.ts because the extractor is not
 * TikTok-specific: yt-dlp handles live Instagram reels through exactly the same
 * code path — 12 formats including progressive mp4, measured. Keeping the
 * client in the TikTok module is what caused Instagram to keep going to Apify
 * after `instagram.com` had already been added to the extractor's allowlist:
 * the extractor could serve it, and nothing ever asked.
 */

export interface ExtractedMedia {
  /** Points at our own extractor's video mode, not at the platform CDN. */
  videoUrl?: string;
  videoHeaders?: Record<string, string>;
  /** Slides of a photo post, in order. Set instead of videoUrl. */
  imageUrls?: string[];
  imageHeaders?: Record<string, string>;
  thumbnailUrl?: string;
  description: string;
  author?: string;
  originalUrl: string;
}

interface ExtractorResponse {
  ok: boolean;
  hasVideo?: boolean;
  images?: string[];
  imageHeaders?: Record<string, string>;
  thumbnailUrl?: string | null;
  description?: string;
  author?: string | null;
  originalUrl?: string;
  outcome?: string;
  error?: string;
}

/** Auth for our own extractor. Both headers are required in production. */
export function extractorHeaders(secret: string): Record<string, string> {
  return {
    "x-extractor-secret": secret,
    // The deployment URL is behind Vercel Authentication on every domain but
    // the custom one. Without the bypass this call answers itself with an SSO
    // redirect page instead of an extraction.
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          "x-vercel-protection-bypass":
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : {}),
  };
}

/**
 * Where the self-hosted extractor lives.
 *
 * Defaults to this same deployment — `api/extract.py` ships in this repo — so a
 * preview calls its own extractor rather than production's, and the two can
 * never skew. `EXTRACTOR_URL` overrides it if the extractor is ever split into
 * its own project. Returns null off-Vercel, which is what makes `next dev`
 * degrade to the free methods instead of erroring on a URL it cannot build.
 */
export function extractorEndpoint(): string | null {
  const explicit = process.env.EXTRACTOR_URL;
  if (explicit) return `${explicit.replace(/\/+$/, "")}/api/extract`;

  const host = process.env.VERCEL_URL;
  return host ? `https://${host}/api/extract` : null;
}

/**
 * Ask the extractor about a URL. Null means "could not", and every caller
 * treats that as a cue to fall through to its own older methods rather than
 * failing the save.
 */
export async function tryExtractor(
  url: string
): Promise<ExtractedMedia | null> {
  const secret = process.env.EXTRACTOR_SECRET;
  const endpoint = extractorEndpoint();

  if (!secret || !endpoint) {
    console.log("Self-hosted extractor not configured, skipping");
    return null;
  }

  try {
    const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, {
      headers: extractorHeaders(secret),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.log(`Extractor returned HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as ExtractorResponse;
    if (!data.ok) {
      // `outcome` is the PLA-15 probe's vocabulary. "blocked" appearing here is
      // the signal that the hosting decision needs revisiting; everything else
      // is an ordinary gap we already degrade around.
      console.log(`Extractor could not extract: ${data.outcome} ${data.error}`);
      return null;
    }

    // ok:true with nothing usable is worse than letting the older methods try,
    // since oEmbed at least returns an official title.
    const images = data.images ?? [];
    if (!data.hasVideo && images.length === 0 && !data.description) return null;

    return {
      // Points back at our own extractor rather than at the platform CDN. A
      // TikTok video URL is bound to the session that negotiated it and answers
      // 403 to everyone else — measured, including with yt-dlp's own headers
      // replayed — so the bytes have to come back through the extractor.
      // Downstream this behaves like any other video URL.
      videoUrl: data.hasVideo
        ? `${endpoint}?url=${encodeURIComponent(url)}&mode=video`
        : undefined,
      videoHeaders: data.hasVideo ? extractorHeaders(secret) : undefined,
      imageUrls: images.length > 0 ? images : undefined,
      imageHeaders: images.length > 0 ? data.imageHeaders : undefined,
      thumbnailUrl: data.thumbnailUrl || undefined,
      description: data.description || "",
      author: data.author || undefined,
      originalUrl: data.originalUrl || url,
    };
  } catch (error) {
    console.log("Self-hosted extractor failed:", error);
    return null;
  }
}

/**
 * Fetch bytes from the extractor's video mode.
 *
 * Platform-agnostic on purpose: once `tryExtractor` has resolved something, the
 * URL points at our own endpoint regardless of whether it started life as a
 * TikTok post or an Instagram reel, and it needs the same auth headers.
 */
export async function downloadExtractedVideo(
  videoUrl: string,
  headers: Record<string, string>
): Promise<Buffer> {
  const response = await fetch(videoUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  // The extractor answers 200 with a JSON body when it could not produce a
  // video. Without this check that JSON reaches Gemini as if it were an mp4.
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const detail = (await response.json()) as { outcome?: string };
    throw new Error(`Extractor returned no video: ${detail.outcome}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
