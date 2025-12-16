import { getPublicVapidKey, isPushConfigured } from "@/lib/push-notifications";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 503 }
    );
  }

  const publicKey = getPublicVapidKey();

  return NextResponse.json({
    publicKey,
    enabled: true,
  });
}

