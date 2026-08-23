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
import { dropDeadLinks } from "@/lib/link-check";
import { mergeOntoExisting, shouldPreserveExisting } from "./preserve";
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

  // Who posted it, for the research step in the prompt: the caption rarely
  // carries the official link, and the profile behind the handle usually does.
  const source = {
    sourceUrl: socialUrl,
    author: videoInfo.author,
    platform: platformName,
  };

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
            videoInfo.description,
            source
          );
        } else {
          analysisResult = await analyzeVideoWithGemini(
            videoData.base64,
            videoInfo.description,
            source
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
        videoInfo.imageHeaders,
        source
      );
    } catch {
      // fall through
    }
  }

  if (!analysisResult && videoInfo.thumbnailUrl) {
    try {
      analysisResult = await analyzeWithThumbnail(
        videoInfo.thumbnailUrl,
        videoInfo.description,
        source
      );
    } catch {
      // fall through
    }
  }

  if (!analysisResult) {
    analysisResult = await analyzeWithDescription(
      videoInfo.description || `${platformName} content`,
      socialUrl,
      source
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

  await verifyLinks(analysisResult, contentId);

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

/**
 * Check every link the model produced before any of it is written down.
 *
 * Mutates in place because the items are about to be saved either way and each
 * one is checked independently — a dead ticket link on item three is no reason
 * to lose the other two.
 */
async function verifyLinks(
  result: MultiItemAnalysisResult,
  contentId: string
): Promise<void> {
  await Promise.all(
    result.items.map(async (item) => {
      item.data = await dropDeadLinks(
        item.data as Record<string, unknown>,
        `${contentId} (${item.title})`
      );
    })
  );
}

/** Best-effort: a tag that will not save is not worth failing an ingest over. */
async function attachTags(
  userId: string,
  contentId: string,
  suggested: string[] | undefined
): Promise<void> {
  if (!suggested?.length) return;
  try {
    const tags = await getOrCreateTags(userId, suggested);
    await addTagsToContent(contentId, tags.map((t) => t.id));
  } catch {
    // ignore tag errors
  }
}

/** The post's own thumbnail, or the picture the analysis found — the latter is
 *  what carries a Google Maps link, whose og:image is usually broken. */
async function thumbnailFor(
  item: { data: unknown },
  contentId: string,
  persistentThumbnailUrl: string | undefined
): Promise<string | undefined> {
  if (persistentThumbnailUrl) return persistentThumbnailUrl;
  const dataImageUrl = (item.data as Record<string, unknown>)?.image_url as
    | string
    | undefined;
  if (!dataImageUrl) return undefined;
  const uploaded = await uploadThumbnailFromUrl(dataImageUrl, contentId);
  return uploaded || dataImageUrl;
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
    // The row being processed becomes the first item instead of being deleted
    // and recreated. Deleting it takes everything keyed on content_id with it —
    // notes, planner entries, gift links and tags all cascade — and the
    // permalink the owner is sitting on starts answering 404. A re-process that
    // splits one saved item into several used to do exactly that.
    const [first, ...rest] = analysisResult.items;
    const existing = await getContentById(contentId);
    const createdContents = [];

    if (shouldPreserveExisting(existing, first)) {
      console.warn(
        `Preserving existing content ${contentId}: re-analysis returned "${first.title}"`
      );
      await updateContent(contentId, { status: "completed" });
      createdContents.push(existing!);
    } else {
      createdContents.push(
        await updateContent(contentId, {
          category: first.category,
          title: first.title,
          data: mergeOntoExisting(existing, first),
          thumbnail_url: await thumbnailFor(
            first,
            contentId,
            persistentThumbnailUrl
          ),
          status: "completed",
        })
      );
      await attachTags(userId, contentId, first.suggested_tags);
    }

    for (const item of rest) {
      const content = await saveContent({
        user_id: userId,
        tiktok_url: socialUrl,
        category: item.category,
        title: item.title,
        data: item.data,
        thumbnail_url: await thumbnailFor(
          item,
          contentId,
          persistentThumbnailUrl
        ),
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
      await attachTags(userId, content.id, item.suggested_tags);
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
  const thumbnailToUse = await thumbnailFor(
    item,
    contentId,
    persistentThumbnailUrl
  );

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
    // Fills the gaps from what the row already held, so a field this read
    // happened to miss is not the same as the field being gone.
    data: mergeOntoExisting(existing, item),
    thumbnail_url: thumbnailToUse,
    status: "completed",
  });
  await attachTags(userId, updatedContent.id, item.suggested_tags);
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
