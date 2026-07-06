import twilio from "twilio";

// Shared phone normalizer; re-exported so callers importing it from here
// (e.g. the Twilio webhook) keep working.
export { normalizePhoneNumber } from "./phone";

// Initialize Twilio client
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials");
  }

  return twilio(accountSid, authToken);
}

// Get Twilio Verify Service SID
function getVerifyServiceSid(): string {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!serviceSid) {
    throw new Error(
      "Missing TWILIO_VERIFY_SERVICE_SID environment variable. " +
        "Create a Verify Service in Twilio Console: https://console.twilio.com/us1/develop/verify/services"
    );
  }

  return serviceSid;
}

// Send verification code via Twilio Verify (avoids A2P 10DLC requirements)
export async function sendVerifyOtp(phoneNumber: string): Promise<void> {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  await client.verify.v2.services(serviceSid).verifications.create({
    to: phoneNumber,
    channel: "sms",
  });
}

// Verify OTP code via Twilio Verify
export async function checkVerifyOtp(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean }> {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  try {
    const verification = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    return { success: verification.status === "approved" };
  } catch (error) {
    console.error("Twilio Verify check error:", error);
    return { success: false };
  }
}

// Validate Twilio webhook request signature
export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    throw new Error("Missing Twilio auth token");
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

// Extract TikTok URL from message body
export function extractTikTokUrl(messageBody: string): string | null {
  // Match various TikTok URL formats
  const patterns = [
    // Standard TikTok video URLs
    /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi,
    // Short TikTok URLs (vm.tiktok.com)
    /https?:\/\/(?:vm|vt)\.tiktok\.com\/[\w]+/gi,
    // Mobile share URLs
    /https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w]+/gi,
  ];

  for (const pattern of patterns) {
    const match = messageBody.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// Extract Instagram URL from message body
export function extractInstagramUrl(messageBody: string): string | null {
  const patterns = [
    // Reels
    /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels)\/[\w-]+\/?/gi,
    // Posts
    /https?:\/\/(?:www\.)?instagram\.com\/p\/[\w-]+\/?/gi,
    // Stories
    /https?:\/\/(?:www\.)?instagram\.com\/stories\/[\w.-]+\/\d+\/?/gi,
    // Short URLs
    /https?:\/\/instagr\.am\/[\w-]+\/?/gi,
  ];

  for (const pattern of patterns) {
    const match = messageBody.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// Extract any generic website URL from message body
export function extractWebsiteUrl(messageBody: string): string | null {
  // Match any http/https URL that's not a social media URL
  // This pattern matches URLs with common TLDs and paths
  const pattern = /https?:\/\/(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s]*)?/gi;

  const match = messageBody.match(pattern);
  if (match) {
    // Return the first URL found, cleaning up any trailing punctuation
    let url = match[0];
    // Remove trailing punctuation that might have been captured
    url = url.replace(/[.,;:!?)]+$/, '');
    return url;
  }

  return null;
}

// Supported platform types
export type SupportedPlatform = "tiktok" | "instagram" | "website";

// Extract any supported URL from message body (social media or website)
export function extractSocialMediaUrl(
  messageBody: string
): { url: string; platform: SupportedPlatform } | null {
  // Try TikTok first
  const tiktokUrl = extractTikTokUrl(messageBody);
  if (tiktokUrl) {
    return { url: tiktokUrl, platform: "tiktok" };
  }

  // Try Instagram
  const instagramUrl = extractInstagramUrl(messageBody);
  if (instagramUrl) {
    return { url: instagramUrl, platform: "instagram" };
  }

  // Fall back to generic website URL
  const websiteUrl = extractWebsiteUrl(messageBody);
  if (websiteUrl) {
    return { url: websiteUrl, platform: "website" };
  }

  return null;
}

