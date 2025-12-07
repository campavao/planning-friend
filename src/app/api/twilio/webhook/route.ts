import { NextRequest, NextResponse } from "next/server";
import { extractTikTokUrl, normalizePhoneNumber } from "@/lib/twilio";
import { getOrCreateUser } from "@/lib/supabase";

// Get the base URL dynamically
function getBaseUrl(request: NextRequest): string {
  // First check explicit env var
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Use Vercel's URL if available
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fall back to request URL
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const body = formData.get("Body") as string;
    const from = formData.get("From") as string;

    if (!body || !from) {
      console.error("Missing required fields from Twilio webhook");
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Normalize the phone number
    const phoneNumber = normalizePhoneNumber(from);

    // Extract TikTok URL from message
    const tiktokUrl = extractTikTokUrl(body);

    if (!tiktokUrl) {
      console.log(
        `No TikTok URL found in message from ${phoneNumber}: ${body}`
      );
      // Return 200 to acknowledge receipt (Twilio expects this)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    console.log(`Received TikTok URL from ${phoneNumber}: ${tiktokUrl}`);

    // Get or create user
    const user = await getOrCreateUser(phoneNumber);
    console.log(`User ID: ${user.id}`);

    // Trigger async processing using the correct base URL
    const appUrl = getBaseUrl(request);
    console.log(`Processing URL: ${appUrl}/api/process`);

    // Fire and forget - don't await
    fetch(`${appUrl}/api/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tiktokUrl,
        userId: user.id,
        phoneNumber,
      }),
    }).catch((error) => {
      console.error("Failed to trigger processing:", error);
    });

    // Return empty TwiML response (no reply SMS for now)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    // Still return 200 to prevent Twilio from retrying
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}

// Twilio sends GET requests for webhook validation
export async function GET() {
  return new NextResponse("Twilio webhook endpoint", { status: 200 });
}
