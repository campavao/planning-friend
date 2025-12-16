import {
  analyzeImage,
  analyzeVideoWithGemini,
  analyzeWebpage,
  analyzeWithDescription,
  analyzeWithThumbnail,
  MultiItemAnalysisResult,
} from "@/lib/gemini";
import { processMmsImage } from "@/lib/image-processing";
import {
  getPlatformDisplayName,
  getSocialMediaInfo,
  getSocialMediaVideoAsBase64,
  SocialPlatform,
} from "@/lib/social-media";
import {
  addTagsToContent,
  createServerClient,
  deleteContent,
  getOrCreateTags,
  saveContent,
  updateContent,
  uploadThumbnailFromUrl,
} from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// Extended platform type to include image-only
type ProcessPlatform = SocialPlatform | "image";

interface ProcessRequest {
  contentId: string;
  // Support both old 'tiktokUrl' and new 'socialUrl' fields for backwards compatibility
  tiktokUrl?: string;
  socialUrl?: string;
  platform?: ProcessPlatform;
  userId: string;
  phoneNumber: string;
  // Message text (for context when processing images)
  messageText?: string;
  // MMS media attachments from Twilio (if user shared via "Share to")
  mmsMedia?: {
    urls: string[];
    types: string[];
  };
}

// Maximum video size to process with full video analysis (20MB)
const MAX_VIDEO_SIZE_FOR_FULL_ANALYSIS = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  console.log("Process API called");

  let contentId: string | undefined;
  let userId: string | undefined;

  try {
    const body: ProcessRequest = await request.json();
    console.log(
      "Process API received body:",
      JSON.stringify(body).slice(0, 200)
    );
    contentId = body.contentId;
    // Support both old 'tiktokUrl' and new 'socialUrl' for backwards compatibility
    const socialUrl = body.socialUrl || body.tiktokUrl;
    const platform = body.platform || "tiktok";
    userId = body.userId;
    const mmsMedia = body.mmsMedia;
    const messageText = body.messageText;

    if (!contentId || !socialUrl || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Handle image-only processing separately
    if (platform === "image") {
      console.log(`Processing image-only content for ${contentId}`);
      return await processImageOnly(
        contentId,
        userId,
        mmsMedia,
        messageText,
        socialUrl
      );
    }

    const platformName = getPlatformDisplayName(platform as SocialPlatform);
    console.log(
      `Processing ${platformName} URL for content ${contentId}: ${socialUrl}`
    );

    // Check if we have MMS media attachments (from "Share to" on mobile)
    if (mmsMedia && mmsMedia.urls.length > 0) {
      console.log(
        `Found ${mmsMedia.urls.length} MMS attachments:`,
        mmsMedia.types
      );
    }

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

      // If we have MMS media but no video/thumbnail from API, use MMS media
      if (mmsMedia && mmsMedia.urls.length > 0) {
        // Find video and image from MMS
        const mmsVideoUrl = mmsMedia.urls.find((_, i) =>
          mmsMedia.types[i]?.startsWith("video/")
        );
        const mmsImageUrl = mmsMedia.urls.find((_, i) =>
          mmsMedia.types[i]?.startsWith("image/")
        );

        // Use MMS video if we don't have one from API
        if (!videoInfo.videoUrl && mmsVideoUrl) {
          console.log("Using MMS video attachment:", mmsVideoUrl);
          videoInfo.videoUrl = mmsVideoUrl;
        }

        // Use MMS image as thumbnail if we don't have one
        if (!videoInfo.thumbnailUrl && (mmsImageUrl || mmsVideoUrl)) {
          const thumbnailSource = mmsImageUrl || mmsVideoUrl;
          console.log(
            "Using MMS attachment as thumbnail source:",
            thumbnailSource
          );
          videoInfo.thumbnailUrl = thumbnailSource;
        }
      }
    } catch (error) {
      console.error("Failed to get media info:", error);

      // If API failed but we have MMS media, use that
      if (mmsMedia && mmsMedia.urls.length > 0) {
        const mmsVideoUrl = mmsMedia.urls.find((_, i) =>
          mmsMedia.types[i]?.startsWith("video/")
        );
        const mmsImageUrl = mmsMedia.urls.find((_, i) =>
          mmsMedia.types[i]?.startsWith("image/")
        );

        console.log("API failed, using MMS media directly");
        videoInfo = {
          platform,
          description: `${platformName} content`,
          originalUrl: socialUrl,
          videoUrl: mmsVideoUrl,
          thumbnailUrl: mmsImageUrl || mmsVideoUrl,
        };
      } else {
        // Create minimal fallback
        videoInfo = {
          platform,
          description: `${platformName} content`,
          originalUrl: socialUrl,
        };
      }
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

    // Step 3: Analyze the content using best available method
    let analysisResult: MultiItemAnalysisResult | undefined;

    // For websites, use webpage analysis with scraped content
    if (platform === "website" && videoInfo.pageContent) {
      try {
        console.log("Using webpage content analysis...");
        analysisResult = await analyzeWebpage(
          videoInfo.pageContent,
          socialUrl,
          {
            thumbnailUrl: videoInfo.thumbnailUrl,
            structuredData: videoInfo.structuredData,
            description: videoInfo.description,
            siteName: videoInfo.siteName,
          }
        );
      } catch (error) {
        console.error("Webpage analysis failed:", error);
      }
    }

    // Try full video analysis if we have a video URL (not for websites)
    if (!analysisResult && videoInfo.videoUrl && platform !== "website") {
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

// Process image-only MMS messages (photos/screenshots sent without URLs)
async function processImageOnly(
  contentId: string,
  userId: string,
  mmsMedia:
    | {
        urls: string[];
        types: string[];
      }
    | undefined,
  messageText: string | undefined,
  placeholderUrl: string
): Promise<NextResponse> {
  console.log("Processing image-only content...");

  try {
    // Find the first image in the MMS attachments
    if (!mmsMedia || mmsMedia.urls.length === 0) {
      console.error("No MMS media provided for image processing");
      await updateContent(contentId, {
        status: "failed",
        title: "No image found",
        data: { error: "No image attachment found in message" },
      });
      return NextResponse.json(
        { error: "No image attachment found" },
        { status: 400 }
      );
    }

    // Find the first image attachment
    const imageIndex = mmsMedia.types.findIndex((type) =>
      type.startsWith("image/")
    );
    if (imageIndex === -1) {
      console.error("No image type found in MMS attachments");
      await updateContent(contentId, {
        status: "failed",
        title: "No image found",
        data: { error: "No image attachment found in message" },
      });
      return NextResponse.json(
        { error: "No image attachment found" },
        { status: 400 }
      );
    }

    const imageUrl = mmsMedia.urls[imageIndex];
    const imageMimeType = mmsMedia.types[imageIndex];

    console.log(`Processing image: ${imageUrl} (${imageMimeType})`);

    // Download and process the image (with EXIF extraction)
    const imageInfo = await processMmsImage(imageUrl);
    if (!imageInfo) {
      console.error("Failed to download/process MMS image");
      await updateContent(contentId, {
        status: "failed",
        title: "Failed to process image",
        data: { error: "Could not download or process the image" },
      });
      return NextResponse.json(
        { error: "Failed to process image" },
        { status: 500 }
      );
    }

    console.log("Image processed successfully:", {
      hasGPS: !!(imageInfo.exif.latitude && imageInfo.exif.longitude),
      hasDate: !!imageInfo.exif.dateTaken,
      mimeType: imageInfo.mimeType,
      size: imageInfo.buffer.length,
    });

    // Upload the image as the thumbnail
    let persistentThumbnailUrl: string | undefined;
    try {
      const supabase = createServerClient();
      const fileName = `${contentId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, imageInfo.buffer, {
          contentType: imageInfo.mimeType,
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(fileName);
        persistentThumbnailUrl = urlData.publicUrl;
        console.log("Image uploaded as thumbnail:", persistentThumbnailUrl);
      } else {
        console.error("Failed to upload image as thumbnail:", uploadError);
      }
    } catch (uploadError) {
      console.error("Error uploading thumbnail:", uploadError);
    }

    // Analyze the image with Gemini + Google Search
    console.log("Analyzing image with Gemini...");
    const analysisResult = await analyzeImage(
      imageInfo.base64,
      imageInfo.mimeType,
      {
        gpsCoordinates:
          imageInfo.exif.latitude && imageInfo.exif.longitude
            ? {
                latitude: imageInfo.exif.latitude,
                longitude: imageInfo.exif.longitude,
              }
            : undefined,
        locationString: imageInfo.locationString,
        dateTaken: imageInfo.exif.dateTaken,
        messageText: messageText,
      }
    );

    console.log("Image analysis result:", {
      isMultiItem: analysisResult.isMultiItem,
      itemCount: analysisResult.items.length,
      items: analysisResult.items.map((i) => ({
        category: i.category,
        title: i.title,
      })),
    });

    // Validate we have at least one item
    if (!analysisResult.items || analysisResult.items.length === 0) {
      console.error("No items returned from image analysis");
      await updateContent(contentId, {
        status: "failed",
        title: "Analysis returned no results",
        data: { error: "Could not extract content from image" },
      });
      return NextResponse.json(
        { error: "Analysis returned no results" },
        { status: 500 }
      );
    }

    // Handle results (similar to main flow)
    if (analysisResult.isMultiItem && analysisResult.items.length > 1) {
      // Multi-item: Delete the placeholder and create individual entries
      console.log(
        `Creating ${analysisResult.items.length} separate content entries from image...`
      );

      await deleteContent(contentId, userId);

      const createdContents = [];
      for (const item of analysisResult.items) {
        const content = await saveContent({
          user_id: userId,
          tiktok_url: placeholderUrl,
          category: item.category,
          title: item.title,
          data: item.data,
          thumbnail_url: persistentThumbnailUrl,
        });
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
          } catch (tagError) {
            console.error("Failed to apply tags:", tagError);
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

      console.log(`Image content updated: ${updatedContent.id}`);

      // Apply suggested tags
      if (item.suggested_tags && item.suggested_tags.length > 0) {
        try {
          const tags = await getOrCreateTags(userId, item.suggested_tags);
          await addTagsToContent(
            updatedContent.id,
            tags.map((t) => t.id)
          );
        } catch (tagError) {
          console.error("Failed to apply tags:", tagError);
        }
      }

      return NextResponse.json({
        success: true,
        content: updatedContent,
      });
    }
  } catch (error) {
    console.error("Error processing image:", error);

    await updateContent(contentId, {
      status: "failed",
      title: "Failed to process image",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
