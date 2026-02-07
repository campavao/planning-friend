import {
  analyzeVideoWithGemini,
  analyzeWebpage,
  analyzeWithDescription,
  analyzeWithThumbnail,
  type MultiItemAnalysisResult,
} from "@/lib/gemini";
import {
  addTagsToContent,
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
import type { ProcessResult } from "./types";

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export async function processSocialContent(
  contentId: string,
  userId: string,
  socialUrl: string,
  platform: SocialPlatform,
  mmsMedia?: { urls: string[]; types: string[] }
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
        }
      );
    } catch {
      // fall through
    }
  }

  if (!analysisResult && videoInfo.videoUrl && platform !== "website") {
    try {
      const videoData = await getSocialMediaVideoAsBase64(socialUrl);
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
    videoInfo.thumbnailUrl
  );
}

async function applySocialAnalysisResult(
  analysisResult: MultiItemAnalysisResult,
  contentId: string,
  userId: string,
  socialUrl: string,
  persistentThumbnailUrl: string | undefined,
  originalThumbnailUrl?: string
): Promise<ProcessResult> {
  if (analysisResult.isMultiItem && analysisResult.items.length > 1) {
    await deleteContent(contentId, userId);
    const createdContents = [];
    for (const item of analysisResult.items) {
      const content = await saveContent({
        user_id: userId,
        tiktok_url: socialUrl,
        category: item.category,
        title: item.title,
        data: item.data,
        thumbnail_url: persistentThumbnailUrl,
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
        await notifyContentReady(userId, first.id, title, first.category);
      } catch {
        // ignore
      }
    }
    return { success: true, multiItem: true, contents: createdContents };
  }

  const item = analysisResult.items[0];
  const updatedContent = await updateContent(contentId, {
    category: item.category,
    title: item.title,
    data: item.data,
    thumbnail_url: persistentThumbnailUrl,
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
  return { success: true, content: updatedContent };
}
