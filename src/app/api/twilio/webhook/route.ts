import { createProcessingContent, getOrCreateUser } from "@/lib/supabase";
import { extractSocialMediaUrl, normalizePhoneNumber } from "@/lib/twilio";
import { after, NextRequest, NextResponse } from "next/server";

// Get the base URL dynamically
function getBaseUrl(request: NextRequest): string {
  // First check explicit env var
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
  ) {
    // Remove trailing slash if present
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
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

    // Check for MMS media attachments
    const numMedia = parseInt(formData.get("NumMedia") as string) || 0;
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      const mediaType = formData.get(`MediaContentType${i}`) as string;
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
        mediaTypes.push(mediaType || "unknown");
        console.log(`MMS attachment ${i}: ${mediaType} - ${mediaUrl}`);
      }
    }

    if (numMedia > 0) {
      console.log(`Received ${numMedia} MMS attachments from ${from}`);
    }

    if (!body || !from) {
      console.error("Missing required fields from Twilio webhook");
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Normalize the phone number
    const phoneNumber = normalizePhoneNumber(from);

    // Extract URL from message (TikTok, Instagram, or any website)
    const socialMedia = extractSocialMediaUrl(body);

    if (!socialMedia) {
      console.log(
        `No supported URL found in message from ${phoneNumber}: ${body}`
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

    console.log(
      `Received ${socialMedia.platform} URL from ${phoneNumber}: ${socialMedia.url}`
    );

    // Get or create user
    const user = await getOrCreateUser(phoneNumber);
    console.log(`User ID: ${user.id}`);

    // Create a processing entry immediately so it shows up in the UI
    const processingContent = await createProcessingContent(
      user.id,
      socialMedia.url
    );
    console.log(`Created processing entry: ${processingContent.id}`);

    // Trigger async processing using the correct base URL
    const appUrl = getBaseUrl(request);
    const processUrl = `${appUrl}/api/process`;
    console.log(`Triggering process API at: ${processUrl}`);

    // Use after() to ensure the processing request completes even after response is sent
    // This prevents items from getting stuck in "processing" status in serverless environments
    after(async () => {
      try {
        const res = await fetch(processUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentId: processingContent.id,
            socialUrl: socialMedia.url,
            platform: socialMedia.platform,
            userId: user.id,
            phoneNumber,
            // Include MMS media if available - can use directly instead of scraping!
            mmsMedia:
              mediaUrls.length > 0
                ? {
                    urls: mediaUrls,
                    types: mediaTypes,
                  }
                : undefined,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Process API error:", res.status, text.slice(0, 500));
        } else {
          console.log(`Process API succeeded: ${res.status}`);
        }
      } catch (error) {
        console.error("Failed to trigger processing:", error);
      }
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
