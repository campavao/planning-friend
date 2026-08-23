import {
  analyzeVideoWithGemini,
  analyzeWebpage,
  analyzeWithDescription,
  analyzeWithImages,
  analyzeWithThumbnail,
  type MultiItemAnalysisResult,
} from "@/lib/gemini";
import {
  addTagsToContent,
  getContentById,
  deleteContent,
  getOrCreateTags,
  saveContent,
  updateContent,
  uploadThumbnailFromUrl,
} from "@/lib/supabase";
import {
  getPlatformDisplayName,
  getSocialMediaInfo,
  getSocialMediaVideoAsBase64,
  type SocialPlatform,
} from "@/lib/social-media";
import { notifyContentReady } from "@/lib/push-notifications";
import { shouldPreserveExisting } from "./preserve";
import type { ProcessResult } from "./types";

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export async function processSocialContent(
  contentId: string,
  userId: string,
  socialUrl: string,
  platform: SocialPlatform,
  mmsMedia?: { urls: string[]; types: string[] },
  options?: { silent?: boolean }
): Promise<ProcessResult> {
  const platformName = getPlatformDisplayName(platform);

  let videoInfo: Awaited<ReturnType<typeof getSocialMediaInfo>>;
  try {
    videoInfo = await getSocialMediaInfo(socialUrl);
    if (mmsMedia?.urls.length) {
      const mmsVideoUrl = mmsMedia.urls.find((_, i) =>
        mmsMedia.types[i]?.startsWith("video/")
      );
      const mmsImageUrl = mmsMedia.urls.find((_, i) =>
        mmsMedia.types[i]?.startsWith("image/")
      );
      if (!videoInfo.videoUrl && mmsVideoUrl) videoInfo.videoUrl = mmsVideoUrl;
      if (!videoInfo.thumbnailUrl)
        videoInfo.thumbnailUrl = mmsImageUrl || mmsVideoUrl;
    }
  } catch {
    if (mmsMedia?.urls.length) {
      const mmsVideoUrl = mmsMedia.urls.find((_, i) =>
        mmsMedia.types[i]?.startsWith("video/")
      );
      const mmsImageUrl = mmsMedia.urls.find((_, i) =>
        mmsMedia.types[i]?.startsWith("image/")
      );
      videoInfo = {
        platform,
        description: `${platformName} content`,
        originalUrl: socialUrl,
        videoUrl: mmsVideoUrl,
        thumbnailUrl: mmsImageUrl || mmsVideoUrl,
      };
    } else {
      videoInfo = {
        platform,
        description: `${platformName} content`,
        originalUrl: socialUrl,
      };
    }
  }

  let persistentThumbnailUrl: string | undefined;
  if (videoInfo.thumbnailUrl) {
    const uploaded = await uploadThumbnailFromUrl(
      videoInfo.thumbnailUrl,
      contentId
    );
    persistentThumbnailUrl = uploaded || videoInfo.thumbnailUrl;
  }

  let analysisResult: MultiItemAnalysisResult | undefined;

  if (platform === "website" && videoInfo.pageContent) {
    try {
      analysisResult = await analyzeWebpage(
        videoInfo.pageContent,
        socialUrl,
        {
          thumbnailUrl: videoInfo.thumbnailUrl,
          structuredData: videoInfo.structuredData,
          description: videoInfo.description,
          siteName: videoInfo.siteName,
          resolvedUrl: videoInfo.resolvedUrl,
        }
      );
    } catch {
      // fall through
    }
  }

  if (!analysisResult && videoInfo.videoUrl && platform !== "website") {
    try {
      // videoInfo is already resolved above; handing it over stops the
      // platform lookup running a second time for the same item.
      const videoData = await getSocialMediaVideoAsBase64(socialUrl, videoInfo);
      if (videoData) {
        const sizeBytes = (videoData.base64.length * 3) / 4;
        if (sizeBytes > MAX_VIDEO_SIZE_BYTES && videoInfo.thumbnailUrl) {
          analysisResult = await analyzeWithThumbnail(
            videoInfo.thumbnailUrl,
            videoInfo.description
          );
        } else {
          analysisResult = await analyzeVideoWithGemini(
            videoData.base64,
            videoInfo.description
          );
        }
      }
    } catch {
      // fall through
    }
  }

  // A slideshow has no video, and its cover alone is close to useless: on
  // these posts the ingredients and steps are written across the slides, so
  // reading one of them is reading a fraction of the recipe. Sits above the
  // thumbnail path so the whole set is used when we have it.
  if (!analysisResult && videoInfo.imageUrls?.length) {
    try {
      analysisResult = await analyzeWithImages(
        videoInfo.imageUrls,
        videoInfo.description,
        videoInfo.imageHeaders
      );
    } catch {
      // fall through
    }
  }

  if (!analysisResult && videoInfo.thumbnailUrl) {
    try {
      analysisResult = await analyzeWithThumbnail(
        videoInfo.thumbnailUrl,
        videoInfo.description
      );
    } catch {
      // fall through
    }
  }

  if (!analysisResult) {
    analysisResult = await analyzeWithDescription(
      videoInfo.description || `${platformName} content`,
      socialUrl
    );
  }

  if (!analysisResult.items?.length) {
    await updateContent(contentId, {
      status: "failed",
      title: "Analysis returned no results",
      data: { error: "Could not extract content from video" },
    });
    return { error: "Analysis returned no results" };
  }

  return await applySocialAnalysisResult(
    analysisResult,
    contentId,
    userId,
    socialUrl,
    persistentThumbnailUrl,
    videoInfo.thumbnailUrl,
    options
  );
}

async function applySocialAnalysisResult(
  analysisResult: MultiItemAnalysisResult,
  contentId: string,
  userId: string,
  socialUrl: string,
  persistentThumbnailUrl: string | undefined,
  originalThumbnailUrl?: string,
  options?: { silent?: boolean }
): Promise<ProcessResult> {
  if (analysisResult.isMultiItem && analysisResult.items.length > 1) {
    await deleteContent(contentId, userId);
    const createdContents = [];
    for (const item of analysisResult.items) {
      // Use image_url from analysis as thumbnail fallback
      let itemThumbnail = persistentThumbnailUrl;
      const dataImageUrl = (item.data as Record<string, unknown>)
        ?.image_url as string | undefined;
      if (dataImageUrl && !persistentThumbnailUrl) {
        const uploaded = await uploadThumbnailFromUrl(dataImageUrl, contentId);
        itemThumbnail = uploaded || dataImageUrl;
      }

      const content = await saveContent({
        user_id: userId,
        tiktok_url: socialUrl,
        category: item.category,
        title: item.title,
        data: item.data,
        thumbnail_url: itemThumbnail,
      });
      if (originalThumbnailUrl && persistentThumbnailUrl) {
        const itemUrl = await uploadThumbnailFromUrl(
          originalThumbnailUrl,
          content.id
        );
        if (itemUrl)
          await updateContent(content.id, { thumbnail_url: itemUrl });
      }
      createdContents.push(content);
      if (item.suggested_tags?.length) {
        try {
          const tags = await getOrCreateTags(userId, item.suggested_tags);
          await addTagsToContent(content.id, tags.map((t) => t.id));
        } catch {
          // ignore
        }
      }
    }
    if (createdContents.length > 0) {
      try {
        const first = createdContents[0];
        const title =
          createdContents.length > 1
            ? `${first.title} (+${createdContents.length - 1} more)`
            : first.title;
        if (!options?.silent) {
          await notifyContentReady(userId, first.id, title, first.category);
        }
      } catch {
        // ignore
      }
    }
    return { success: true, multiItem: true, contents: createdContents };
  }

  const item = analysisResult.items[0];

  // If Gemini found an image_url via Google Search and we don't have a good thumbnail,
  // use it as the thumbnail (common for Google Maps links where og:image is broken)
  let thumbnailToUse = persistentThumbnailUrl;
  const dataImageUrl = (item.data as Record<string, unknown>)?.image_url as
    | string
    | undefined;
  if (dataImageUrl && !persistentThumbnailUrl) {
    const uploaded = await uploadThumbnailFromUrl(dataImageUrl, contentId);
    thumbnailToUse = uploaded || dataImageUrl;
  }

  const existing = await getContentById(contentId);
  if (shouldPreserveExisting(existing, item)) {
    // The re-analysis came back empty. Keep what is already saved and just
    // clear the "processing" flag the reprocess route set on the way in.
    console.warn(
      `Preserving existing content ${contentId}: re-analysis returned "${item.title}"`
    );
    await updateContent(contentId, { status: "completed" });
    return { success: true, content: existing! };
  }

  const updatedContent = await updateContent(contentId, {
    category: item.category,
    title: item.title,
    data: item.data,
    thumbnail_url: thumbnailToUse,
    status: "completed",
  });
  if (item.suggested_tags?.length) {
    try {
      const tags = await getOrCreateTags(userId, item.suggested_tags);
      await addTagsToContent(updatedContent.id, tags.map((t) => t.id));
    } catch {
      // ignore
    }
  }
  if (!options?.silent) {
    try {
      await notifyContentReady(
        userId,
        updatedContent.id,
        item.title,
        item.category
      );
    } catch {
      // ignore
    }
  }
  return { success: true, content: updatedContent };
}
