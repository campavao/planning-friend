// How an item got here: a link someone texted in, or a photo they texted in.
//
// Photos have no page to link back to, so the Twilio webhook parks a
// placeholder in `tiktok_url` instead of a real URL and the prefix becomes the
// discriminator everything downstream reads. Until there is a `source_type`
// column that string is load-bearing, so it lives in exactly one place.
//
// Kept out of social-media.ts deliberately: this is imported by client
// components, and social-media.ts drags the TikTok/Instagram/website scrapers
// in with it.

const IMAGE_SOURCE_PREFIX = "mms://image/";

// The timestamp carries no meaning beyond keeping the value unique per message.
export function createImageSourceUrl(): string {
  return `${IMAGE_SOURCE_PREFIX}${Date.now()}`;
}

export function isImageSourcedItem(url: string | null | undefined): boolean {
  return !!url && url.startsWith(IMAGE_SOURCE_PREFIX);
}

// Sources whose page is a video. The thumbnail we store for one of these is a
// still lifted out of the post, so blowing it up full-screen shows a frame of
// something the reader wanted to watch — tapping it should open the post
// instead.
//
// Suffix-matched, so the TikTok short domains (vm./vt.) and Instagram's
// regional hosts come along without being listed.
const VIDEO_SOURCE_DOMAINS = [
  "tiktok.com",
  "instagram.com",
  "instagr.am",
  "facebook.com",
  "fb.watch",
  "youtube.com",
  "youtu.be",
];

export function isVideoSourceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return VIDEO_SOURCE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
