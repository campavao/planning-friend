import {
  analyzeImage,
  MultiItemAnalysisResult,
} from "@/lib/gemini";
import { processMmsImage } from "@/lib/image-processing";
import { notifyContentReady } from "@/lib/push-notifications";
import {
  addTagsToContent,
  createServerClient,
  deleteContent,
  getOrCreateTags,
  saveContent,
  updateContent,
} from "@/lib/supabase";
import type { ProcessResult } from "./types";

const THUMBNAILS_BUCKET = "thumbnails";

export async function processImageContent(
  contentId: string,
  userId: string,
  mmsMedia: { urls: string[]; types: string[] } | undefined,
  messageText: string | undefined,
  placeholderUrl: string
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

  return await applyAnalysisResult(
    analysisResult,
    contentId,
    userId,
    placeholderUrl,
    persistentThumbnailUrl
  );
}

async function applyAnalysisResult(
  analysisResult: MultiItemAnalysisResult,
  contentId: string,
  userId: string,
  socialUrl: string,
  persistentThumbnailUrl: string | undefined
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
      createdContents.push(content);
      if (item.suggested_tags?.length) {
        try {
          const tags = await getOrCreateTags(userId, item.suggested_tags);
          await addTagsToContent(content.id, tags.map((t) => t.id));
        } catch {
          // ignore tag errors
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
