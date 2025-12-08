import { NextRequest, NextResponse } from "next/server";
import {
  verifyPhoneOtp,
  getOrCreateUser,
  normalizePhoneNumber,
} from "@/lib/supabase";
import { cookies } from "next/headers";

interface VerifyRequest {
  phoneNumber: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { phoneNumber, code } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Phone number and code are required" },
        { status: 400 }
      );
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Verify the code via Supabase Auth
    const result = await verifyPhoneOtp(normalizedPhone, code);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 401 }
      );
    }

    // Get or create the user in our users table
    const user = await getOrCreateUser(normalizedPhone);

    // Create a simple session token (in production, use a proper JWT)
    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: user.id,
        phoneNumber: normalizedPhone,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      })
    ).toString("base64");

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
      },
    });
  } catch (error) {
    console.error("Error verifying code:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
