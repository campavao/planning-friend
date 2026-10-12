import { NextRequest, NextResponse } from "next/server";
import { sendPhoneOtp, normalizePhoneNumber } from "@/lib/supabase";
import { sendCodeBodySchema } from "@/lib/schemas/auth";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

const HOUR = 60 * 60;

// [key, max sends, window in seconds]. Real traffic is about one login a day,
// so the global cap is a circuit breaker: bots that rotate IPs and numbers get
// at most 50 texts a day out of it instead of an open tap.
const SEND_CODE_LIMITS = (
  ip: string,
  phone: string
): [string, number, number][] => [
  [`send-code:ip:${ip}`, 5, HOUR],
  [`send-code:phone:${phone}`, 5, HOUR],
  ["send-code:global", 50, 24 * HOUR],
];

export async function POST(request: NextRequest) {
  try {
    const parsed = sendCodeBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(parsed.data.phoneNumber);

    // Validate phone number format
    if (!normalizedPhone.match(/^\+\d{10,15}$/)) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Only send codes to North American numbers. This endpoint is public, and
    // open international delivery got it hit by SMS-pumping bots sending
    // codes to premium-rate numbers abroad.
    if (!normalizedPhone.match(/^\+1\d{10}$/)) {
      return NextResponse.json(
        { error: "Only US and Canadian phone numbers are supported" },
        { status: 400 }
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json(
        { error: "Server configuration error (Supabase)" },
        { status: 500 }
      );
    }

    // Checked in order and short-circuited, so a request refused per-IP never
    // spends the per-phone or global budget. A database error here throws and
    // refuses the send rather than letting it through unmetered.
    const ip = clientIp(request.headers);
    for (const [key, limit, windowSeconds] of SEND_CODE_LIMITS(ip, normalizedPhone)) {
      if (!(await hitRateLimit(key, limit, windowSeconds))) {
        console.warn(`send-code rate limited on ${key.split(":")[1]}`);
        return NextResponse.json(
          { error: "Too many code requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    // Send OTP via Supabase's built-in phone auth
    await sendPhoneOtp(normalizedPhone);

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
    });
  } catch (error) {
    console.error("Error sending verification code:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
