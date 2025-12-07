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

// Send SMS message (keeping for potential future use, but note A2P requirements)
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

// Legacy function - now uses Twilio Verify instead
export async function sendVerificationCode(
  phoneNumber: string,
  code: string
): Promise<void> {
  // This function is deprecated - use sendVerifyOtp instead
  // Keeping for backward compatibility but it will use direct SMS
  // which requires A2P 10DLC registration
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
