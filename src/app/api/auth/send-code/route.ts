import { NextRequest, NextResponse } from "next/server";
import { sendPhoneOtp, normalizePhoneNumber } from "@/lib/supabase";
import { sendCodeBodySchema } from "@/lib/schemas/auth";

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
