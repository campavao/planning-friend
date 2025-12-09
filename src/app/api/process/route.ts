import {
  analyzeVideoWithGemini,
  analyzeWithDescription,
  analyzeWithThumbnail,
  MultiItemAnalysisResult,
} from "@/lib/gemini";
import {
  getPlatformDisplayName,
  getSocialMediaInfo,
  getSocialMediaVideoAsBase64,
  SocialPlatform,
} from "@/lib/social-media";
import {
  addTagsToContent,
  deleteContent,
  getOrCreateTags,
  saveContent,
  updateContent,
  uploadThumbnailFromUrl,
} from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

interface ProcessRequest {
  contentId: string;
  // Support both old 'tiktokUrl' and new 'socialUrl' fields for backwards compatibility
  tiktokUrl?: string;
  socialUrl?: string;
  platform?: SocialPlatform;
  userId: string;
  phoneNumber: string;
}

// Maximum video size to process with full video analysis (20MB)
const MAX_VIDEO_SIZE_FOR_FULL_ANALYSIS = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let contentId: string | undefined;
  let userId: string | undefined;

  try {
    const body: ProcessRequest = await request.json();
    contentId = body.contentId;
    // Support both old 'tiktokUrl' and new 'socialUrl' for backwards compatibility
    const socialUrl = body.socialUrl || body.tiktokUrl;
    const platform = body.platform || "tiktok";
    userId = body.userId;

    if (!contentId || !socialUrl || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const platformName = getPlatformDisplayName(platform);
    console.log(
      `Processing ${platformName} URL for content ${contentId}: ${socialUrl}`
    );

    // Step 1: Get video/media info from the platform (with fallbacks)
    let videoInfo;
    try {
      videoInfo = await getSocialMediaInfo(socialUrl);
      console.log("Media info retrieved:", {
        platform: videoInfo.platform,
        hasVideoUrl: !!videoInfo.videoUrl,
        hasThumbnail: !!videoInfo.thumbnailUrl,
        description: videoInfo.description?.substring(0, 100),
      });
    } catch (error) {
      console.error("Failed to get media info:", error);
      // Create minimal fallback
      videoInfo = {
        platform,
        description: `${platformName} content`,
        originalUrl: socialUrl,
      };
    }

    // Step 2: Upload thumbnail to Supabase Storage (so it doesn't expire)
    let persistentThumbnailUrl: string | undefined;
    if (videoInfo.thumbnailUrl) {
      console.log("Uploading thumbnail to storage...");
      const uploadedUrl = await uploadThumbnailFromUrl(
        videoInfo.thumbnailUrl,
        contentId
      );
      if (uploadedUrl) {
        persistentThumbnailUrl = uploadedUrl;
        console.log("Thumbnail uploaded successfully:", persistentThumbnailUrl);
      } else {
        console.log(
          "Thumbnail upload failed, will use original URL as fallback"
        );
        persistentThumbnailUrl = videoInfo.thumbnailUrl;
      }
    }

    // Step 3: Analyze the video using best available method
    let analysisResult: MultiItemAnalysisResult | undefined;

    // Try full video analysis if we have a video URL
    if (videoInfo.videoUrl) {
      try {
        console.log("Attempting full video analysis...");
        const videoData = await getSocialMediaVideoAsBase64(socialUrl);

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

    // Fall back to thumbnail analysis if we have a thumbnail (use original URL for analysis)
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
        videoInfo.description || `${platformName} content`,
        socialUrl
      );
    }

    console.log("Analysis result:", {
      isMultiItem: analysisResult.isMultiItem,
      itemCount: analysisResult.items.length,
      items: analysisResult.items.map((i) => ({
        category: i.category,
        title: i.title,
      })),
    });

    // Step 4: Handle single vs multi-item results
    // Validate that we have at least one item
    if (!analysisResult.items || analysisResult.items.length === 0) {
      console.error("No items returned from analysis");
      await updateContent(contentId, {
        status: "failed",
        title: "Analysis returned no results",
        data: { error: "Could not extract content from video" },
      });
      return NextResponse.json(
        { error: "Analysis returned no results" },
        { status: 500 }
      );
    }

    if (analysisResult.isMultiItem && analysisResult.items.length > 1) {
      // Multi-item: Delete the placeholder and create individual entries
      console.log(
        `Creating ${analysisResult.items.length} separate content entries...`
      );

      // Delete the original processing placeholder (with user validation)
      await deleteContent(contentId, userId);

      // Create individual content entries for each item
      // For multi-item, we need to upload separate thumbnails for each
      const createdContents = [];
      for (const item of analysisResult.items) {
        const content = await saveContent({
          user_id: userId,
          tiktok_url: socialUrl, // Field name kept for DB compatibility
          category: item.category,
          title: item.title,
          data: item.data,
          thumbnail_url: persistentThumbnailUrl,
        });

        // Upload thumbnail for this specific content item (since contentId changes)
        if (videoInfo.thumbnailUrl && persistentThumbnailUrl) {
          const itemThumbnailUrl = await uploadThumbnailFromUrl(
            videoInfo.thumbnailUrl,
            content.id
          );
          if (itemThumbnailUrl) {
            // Update with the item-specific thumbnail URL
            await updateContent(content.id, {
              thumbnail_url: itemThumbnailUrl,
            });
            content.thumbnail_url = itemThumbnailUrl;
          }
        }
        createdContents.push(content);
        console.log(`Created content: ${content.id} - ${content.title}`);

        // Apply suggested tags
        if (item.suggested_tags && item.suggested_tags.length > 0) {
          try {
            const tags = await getOrCreateTags(userId, item.suggested_tags);
            await addTagsToContent(
              content.id,
              tags.map((t) => t.id)
            );
            console.log(
              `Applied ${tags.length} tags to content: ${content.id}`
            );
          } catch (tagError) {
            console.error("Failed to apply tags:", tagError);
            // Don't fail the whole process for tag errors
          }
        }
      }

      return NextResponse.json({
        success: true,
        multiItem: true,
        contents: createdContents,
      });
    } else {
      // Single item: Update the existing entry
      const item = analysisResult.items[0];
      const updatedContent = await updateContent(contentId, {
        category: item.category,
        title: item.title,
        data: item.data,
        thumbnail_url: persistentThumbnailUrl,
        status: "completed",
      });

      console.log(`Content updated: ${updatedContent.id}`);

      // Apply suggested tags
      if (item.suggested_tags && item.suggested_tags.length > 0) {
        try {
          const tags = await getOrCreateTags(userId, item.suggested_tags);
          await addTagsToContent(
            updatedContent.id,
            tags.map((t) => t.id)
          );
          console.log(
            `Applied ${tags.length} tags to content: ${updatedContent.id}`
          );
        } catch (tagError) {
          console.error("Failed to apply tags:", tagError);
          // Don't fail the whole process for tag errors
        }
      }

      return NextResponse.json({
        success: true,
        content: updatedContent,
      });
    }
  } catch (error) {
    console.error("Error processing social media content:", error);

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
