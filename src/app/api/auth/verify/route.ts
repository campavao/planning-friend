import { NextRequest, NextResponse } from "next/server";
import {
  verifyPhoneOtp,
  getOrCreateUser,
  normalizePhoneNumber,
} from "@/lib/supabase";
import { cookies } from "next/headers";
import { createSessionToken } from "@/lib/auth";
import { verifyBodySchema } from "@/lib/schemas/auth";
import { SESSION_EXPIRATION_MS, SESSION_EXPIRATION_SECONDS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const parsed = verifyBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const { phoneNumber, code } = parsed.data;

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

    // Check if this is a new user (no name set)
    const isNewUser = !user.name;

    const sessionToken = await createSessionToken({
      userId: user.id,
      phoneNumber: normalizedPhone,
      exp: Date.now() + SESSION_EXPIRATION_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRATION_SECONDS,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      isNewUser,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name,
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
