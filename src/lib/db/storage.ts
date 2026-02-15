import { createServerClient } from "./client";

const THUMBNAILS_BUCKET = "thumbnails";

export async function uploadThumbnailFromUrl(
  imageUrl: string,
  contentId: string
): Promise<string | null> {
  try {
    const isInstagramCdn =
      imageUrl.includes("instagram") ||
      imageUrl.includes("fbcdn") ||
      imageUrl.includes("cdninstagram");

    let response: Response | null = null;

    if (isInstagramCdn) {
      const userAgents = [
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Twitterbot/1.0",
        "WhatsApp/2.23.20.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ];

      for (const userAgent of userAgents) {
        try {
          const tryResponse = await fetch(imageUrl, {
            headers: {
              "User-Agent": userAgent,
              Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          if (tryResponse.ok) {
            response = tryResponse;
            break;
          }
        } catch {
          // try next
        }
      }

      if (!response) {
        return null;
      }
    } else {
      response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extension = "jpg";
    if (contentType.includes("png")) {
      extension = "png";
    } else if (contentType.includes("webp")) {
      extension = "webp";
    } else if (contentType.includes("gif")) {
      extension = "gif";
    }

    const supabase = createServerClient();
    const fileName = `${contentId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(THUMBNAILS_BUCKET)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch {
    return null;
  }
}

export async function deleteThumbnail(contentId: string): Promise<void> {
  const supabase = createServerClient();

  const extensions = ["jpg", "png", "webp", "gif"];
  const filesToDelete = extensions.map((ext) => `${contentId}.${ext}`);

  const { error } = await supabase.storage
    .from(THUMBNAILS_BUCKET)
    .remove(filesToDelete);

  if (error) {
    console.error("Failed to delete thumbnail:", error);
  }
}
