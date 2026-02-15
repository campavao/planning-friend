import { processContent } from "@/lib/processing";
import { updateContent } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let contentId: string | undefined;

  try {
    const body = await request.json();
    contentId = body.contentId;
    const socialUrl = body.socialUrl || body.tiktokUrl;
    const userId = body.userId;

    if (!contentId || !socialUrl || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await processContent({
      contentId,
      userId,
      phoneNumber: body.phoneNumber ?? "",
      socialUrl,
      tiktokUrl: body.tiktokUrl,
      platform: body.platform,
      messageText: body.messageText,
      mmsMedia: body.mmsMedia,
    });

    if ("error" in result) {
      const status =
        result.error === "Missing required fields" ||
        result.error.includes("No image attachment")
          ? 400
          : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    if ("multiItem" in result) {
      return NextResponse.json({
        success: true,
        multiItem: true,
        contents: result.contents,
      });
    }

    return NextResponse.json({
      success: true,
      content: result.content,
    });
  } catch (error) {
    console.error("Error processing content:", error);
    if (contentId) {
      try {
        await updateContent(contentId, {
          status: "failed",
          title: "Failed to process",
          data: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
