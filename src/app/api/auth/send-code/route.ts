import { NextRequest, NextResponse } from "next/server";
import { sendPhoneOtp, normalizePhoneNumber } from "@/lib/supabase";

interface SendCodeRequest {
  phoneNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendCodeRequest = await request.json();
    const { phoneNumber } = body;

    console.log("Send code request received for:", phoneNumber);

    if (!phoneNumber) {
      console.log("Error: Phone number is missing");
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log("Normalized phone:", normalizedPhone);

    // Validate phone number format
    if (!normalizedPhone.match(/^\+\d{10,15}$/)) {
      console.log("Error: Invalid phone number format:", normalizedPhone);
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Check environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("Environment check:", {
      hasSupabaseUrl,
      hasSupabaseAnonKey,
    });

    if (!hasSupabaseUrl || !hasSupabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json(
        { error: "Server configuration error (Supabase)" },
        { status: 500 }
      );
    }

    // Send OTP via Supabase's built-in phone auth
    console.log("Sending OTP via Supabase...");
    await sendPhoneOtp(normalizedPhone);
    console.log("OTP sent successfully to:", normalizedPhone);

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
    });
  } catch (error) {
    console.error("Error sending verification code:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
