import { detectPlatform } from "@/lib/social-media";
import { getContentById, updateContent } from "@/lib/supabase";
import { after, NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

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
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

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

    // Allow reprocessing of completed content
    // if (content.status === "completed") {
    //   return NextResponse.json(
    //     { error: "Content has already finished processing" },
    //     { status: 400 }
    //   );
    // }

    await updateContent(id, { status: "processing" });

    const platform = detectPlatform(content.tiktok_url);
    const baseUrl = getBaseUrl(request);
    const processUrl = `${baseUrl}/api/process`;

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
            contentId: content.id,
            socialUrl: content.tiktok_url,
            platform,
            userId: session.userId,
            phoneNumber: session.phoneNumber,
            retry: true,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to trigger reprocess:", res.status, text);
        } else {
          console.log(`Reprocess API succeeded: ${res.status}`);
        }
      } catch (error) {
        console.error("Error calling process API:", error);
      }
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
