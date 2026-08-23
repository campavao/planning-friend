import {
  analyzeImage,
  MultiItemAnalysisResult,
} from "@/lib/gemini";
import { processMmsImage } from "@/lib/image-processing";
import { notifyContentReady } from "@/lib/push-notifications";
import {
  addTagsToContent,
  getContentById,
  createServerClient,
  getOrCreateTags,
  saveContent,
  updateContent,
} from "@/lib/supabase";
import { dropDeadLinks } from "@/lib/link-check";
import { mergeOntoExisting, shouldPreserveExisting } from "./preserve";
import type { ProcessResult } from "./types";

const THUMBNAILS_BUCKET = "thumbnails";

export async function processImageContent(
  contentId: string,
  userId: string,
  mmsMedia: { urls: string[]; types: string[] } | undefined,
  messageText: string | undefined,
  placeholderUrl: string,
  options?: { silent?: boolean }
): Promise<ProcessResult> {
  if (!mmsMedia || mmsMedia.urls.length === 0) {
    await updateContent(contentId, {
      status: "failed",
      title: "No image found",
      data: { error: "No image attachment found in message" },
    });
    return { error: "No image attachment found in message" };
  }

  const imageIndex = mmsMedia.types.findIndex((type) =>
    type.startsWith("image/")
  );
  if (imageIndex === -1) {
    await updateContent(contentId, {
      status: "failed",
      title: "No image found",
      data: { error: "No image attachment found in message" },
    });
    return { error: "No image attachment found in message" };
  }

  const imageUrl = mmsMedia.urls[imageIndex];
  const imageMimeType = mmsMedia.types[imageIndex];

  const imageInfo = await processMmsImage(imageUrl);
  if (!imageInfo) {
    await updateContent(contentId, {
      status: "failed",
      title: "Failed to process image",
      data: { error: "Could not download or process the image" },
    });
    return { error: "Could not download or process the image" };
  }

  let persistentThumbnailUrl: string | undefined;
  try {
    const supabase = createServerClient();
    const fileName = `${contentId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(fileName, imageInfo.buffer, {
        contentType: imageInfo.mimeType,
        upsert: true,
      });
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from(THUMBNAILS_BUCKET)
        .getPublicUrl(fileName);
      persistentThumbnailUrl = urlData.publicUrl;
    }
  } catch {
    // continue without thumbnail
  }

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
      messageText,
    }
  );

  // Same check the social path runs: a link that goes nowhere is worse than
  // no link, and a photo of a menu board invites exactly that kind of guess.
  await Promise.all(
    (analysisResult.items ?? []).map(async (item) => {
      item.data = await dropDeadLinks(
        item.data as Record<string, unknown>,
        `${contentId} (${item.title})`
      );
    })
  );

  return await applyAnalysisResult(
    analysisResult,
    contentId,
    userId,
    placeholderUrl,
    persistentThumbnailUrl,
    options
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

async function applyAnalysisResult(
  analysisResult: MultiItemAnalysisResult,
  contentId: string,
  userId: string,
  socialUrl: string,
  persistentThumbnailUrl: string | undefined,
  options?: { silent?: boolean }
): Promise<ProcessResult> {
  if (!analysisResult.items || analysisResult.items.length === 0) {
    await updateContent(contentId, {
      status: "failed",
      title: "Analysis returned no results",
      data: { error: "Could not extract content from image" },
    });
    return { error: "Analysis returned no results" };
  }

  if (analysisResult.isMultiItem && analysisResult.items.length > 1) {
    // The row being processed becomes the first item instead of being deleted
    // and recreated. Deleting it takes everything keyed on content_id with it —
    // notes, planner entries, gift links and tags all cascade — and the
    // permalink the owner is sitting on starts answering 404.
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
          thumbnail_url: persistentThumbnailUrl,
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
        thumbnail_url: persistentThumbnailUrl,
      });
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
