import { NextRequest, NextResponse } from "next/server";
import { getTikTokVideoAsBase64, getTikTokVideoInfo } from "@/lib/tiktok";
import {
  analyzeVideoWithGemini,
  analyzeWithThumbnail,
  analyzeWithDescription,
} from "@/lib/gemini";
import { updateContent } from "@/lib/supabase";

interface ProcessRequest {
  contentId: string;
  tiktokUrl: string;
  userId: string;
  phoneNumber: string;
}

// Maximum video size to process with full video analysis (20MB)
const MAX_VIDEO_SIZE_FOR_FULL_ANALYSIS = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let contentId: string | undefined;

  try {
    const body: ProcessRequest = await request.json();
    contentId = body.contentId;
    const { tiktokUrl, userId } = body;

    if (!contentId || !tiktokUrl || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`Processing TikTok URL for content ${contentId}: ${tiktokUrl}`);

    // Step 1: Get video info from TikTok (with fallbacks)
    let videoInfo;
    try {
      videoInfo = await getTikTokVideoInfo(tiktokUrl);
      console.log("Video info retrieved:", {
        hasVideoUrl: !!videoInfo.videoUrl,
        hasThumbnail: !!videoInfo.thumbnailUrl,
        description: videoInfo.description?.substring(0, 100),
      });
    } catch (error) {
      console.error("Failed to get video info:", error);
      // Create minimal fallback
      videoInfo = {
        description: "TikTok video",
        originalUrl: tiktokUrl,
      };
    }

    // Step 2: Analyze the video using best available method
    let analysisResult;

    // Try full video analysis if we have a video URL
    if (videoInfo.videoUrl) {
      try {
        console.log("Attempting full video analysis...");
        const videoData = await getTikTokVideoAsBase64(tiktokUrl);

        if (videoData) {
          const videoSizeBytes = (videoData.base64.length * 3) / 4;

          if (videoSizeBytes > MAX_VIDEO_SIZE_FOR_FULL_ANALYSIS) {
            console.log(
              `Video too large (${Math.round(
                videoSizeBytes / 1024 / 1024
              )}MB), using thumbnail analysis`
            );
            if (videoInfo.thumbnailUrl) {
              analysisResult = await analyzeWithThumbnail(
                videoInfo.thumbnailUrl,
                videoInfo.description
              );
            }
          } else {
            analysisResult = await analyzeVideoWithGemini(
              videoData.base64,
              videoInfo.description
            );
          }
        }
      } catch (error) {
        console.error("Full video analysis failed:", error);
      }
    }

    // Fall back to thumbnail analysis if we have a thumbnail
    if (!analysisResult && videoInfo.thumbnailUrl) {
      try {
        console.log("Using thumbnail analysis...");
        analysisResult = await analyzeWithThumbnail(
          videoInfo.thumbnailUrl,
          videoInfo.description
        );
      } catch (error) {
        console.error("Thumbnail analysis failed:", error);
      }
    }

    // Last resort: analyze based on description only
    if (!analysisResult) {
      console.log("Using description-only analysis...");
      analysisResult = await analyzeWithDescription(
        videoInfo.description || "TikTok video",
        tiktokUrl
      );
    }

    console.log("Analysis result:", {
      category: analysisResult.category,
      title: analysisResult.title,
    });

    // Step 3: Update the content entry with results
    const updatedContent = await updateContent(contentId, {
      category: analysisResult.category,
      title: analysisResult.title,
      data: analysisResult.data,
      thumbnail_url: videoInfo.thumbnailUrl,
      status: "completed",
    });

    console.log(`Content updated: ${updatedContent.id}`);

    return NextResponse.json({
      success: true,
      content: updatedContent,
    });
  } catch (error) {
    console.error("Error processing TikTok video:", error);

    // Mark as failed if we have a contentId
    if (contentId) {
      try {
        await updateContent(contentId, {
          status: "failed",
          title: "Failed to process",
          data: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      } catch (updateError) {
        console.error("Failed to update content status:", updateError);
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
