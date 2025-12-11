import { detectPlatform } from "@/lib/social-media";
import { getContentById, updateContent } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

interface SessionData {
  userId: string;
  phoneNumber: string;
  exp: number;
}

async function getSessionUser(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString()
    ) as SessionData;

    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function getBaseUrl(request: NextRequest): string {
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
  ) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const content = await getContentById(id);

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (content.user_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!content.tiktok_url) {
      return NextResponse.json(
        { error: "Content is missing its source URL" },
        { status: 400 }
      );
    }

    if (content.status === "completed") {
      return NextResponse.json(
        { error: "Content has already finished processing" },
        { status: 400 }
      );
    }

    await updateContent(id, { status: "processing" });

    const platform = detectPlatform(content.tiktok_url);
    const baseUrl = getBaseUrl(request);
    const processUrl = `${baseUrl}/api/process`;

    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentId: content.id,
        socialUrl: content.tiktok_url,
        platform,
        userId: session.userId,
        phoneNumber: session.phoneNumber,
        retry: true,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          res.text().then((text) =>
            console.error("Failed to trigger reprocess:", res.status, text)
          );
        }
      })
      .catch((error) => {
        console.error("Error calling process API:", error);
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error retrying content processing:", error);
    return NextResponse.json(
      { error: "Failed to retry processing" },
      { status: 500 }
    );
  }
}

