import twilio from "twilio";

// Initialize Twilio client
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials");
  }

  return twilio(accountSid, authToken);
}

// Send SMS message
export async function sendSMS(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!from) {
    throw new Error("Missing Twilio phone number");
  }

  await client.messages.create({
    body,
    from,
    to,
  });
}

// Send verification code via SMS
export async function sendVerificationCode(
  phoneNumber: string,
  code: string
): Promise<void> {
  const message = `Your TikTok Helper verification code is: ${code}. This code expires in 10 minutes.`;
  await sendSMS(phoneNumber, message);
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

// Normalize phone number to E.164 format
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else if (normalized.length === 11 && normalized.startsWith("1")) {
      normalized = "+" + normalized;
    }
  }

  return normalized;
}
