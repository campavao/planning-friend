import { NextRequest, NextResponse } from 'next/server';
import { createVerificationCode } from '@/lib/supabase';
import { sendVerificationCode, normalizePhoneNumber } from '@/lib/twilio';

interface SendCodeRequest {
  phoneNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendCodeRequest = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Validate phone number format
    if (!normalizedPhone.match(/^\+\d{10,15}$/)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Generate and store verification code
    const code = await createVerificationCode(normalizedPhone);

    // Send the code via SMS
    await sendVerificationCode(normalizedPhone, code);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('Error sending verification code:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

