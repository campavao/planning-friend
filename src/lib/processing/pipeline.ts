import { processImageContent } from "./image-processor";
import { processSocialContent } from "./social-processor";
import type { ProcessInput, ProcessResult } from "./types";

export async function processContent(input: ProcessInput): Promise<ProcessResult> {
  const contentId = input.contentId;
  const userId = input.userId;
  const socialUrl = input.socialUrl || input.tiktokUrl;
  const platform = input.platform || "tiktok";

  if (!contentId || !socialUrl || !userId) {
    return { error: "Missing required fields" };
  }

  if (platform === "image") {
    return processImageContent(
      contentId,
      userId,
      input.mmsMedia,
      input.messageText,
      socialUrl
    );
  }

  return processSocialContent(
    contentId,
    userId,
    socialUrl,
    platform as "tiktok" | "instagram" | "website",
    input.mmsMedia
  );
}
