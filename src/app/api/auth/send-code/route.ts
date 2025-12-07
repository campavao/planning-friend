import { NextRequest, NextResponse } from "next/server";
import { createVerificationCode } from "@/lib/supabase";
import { sendVerificationCode, normalizePhoneNumber } from "@/lib/twilio";

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
    const hasTwilioSid = !!process.env.TWILIO_ACCOUNT_SID;
    const hasTwilioToken = !!process.env.TWILIO_AUTH_TOKEN;
    const hasTwilioPhone = !!process.env.TWILIO_PHONE_NUMBER;
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("Environment check:", {
      hasTwilioSid,
      hasTwilioToken,
      hasTwilioPhone,
      hasSupabaseUrl,
      hasSupabaseKey,
    });

    if (!hasTwilioSid || !hasTwilioToken || !hasTwilioPhone) {
      console.error("Missing Twilio environment variables");
      return NextResponse.json(
        { error: "Server configuration error (Twilio)" },
        { status: 500 }
      );
    }

    if (!hasSupabaseUrl || !hasSupabaseKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json(
        { error: "Server configuration error (Database)" },
        { status: 500 }
      );
    }

    // Generate and store verification code
    console.log("Creating verification code in database...");
    const code = await createVerificationCode(normalizedPhone);
    console.log("Verification code created successfully");

    // Send the code via SMS
    console.log("Sending SMS via Twilio...");
    await sendVerificationCode(normalizedPhone, code);
    console.log(
      "SMS sent successfully to:",
      normalizedPhone,
      "with code:",
      code
    );

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
