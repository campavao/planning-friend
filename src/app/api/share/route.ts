import { analyzeImage } from "@/lib/gemini";
import { extractExifData, formatGpsCoordinates } from "@/lib/image-processing";
import { notifyContentReady } from "@/lib/push-notifications";
import {
  addTagsToContent,
  createProcessingContent,
  createServerClient,
  deleteContent,
  getOrCreateTags,
  saveContent,
  updateContent,
} from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the user from the session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie?.value) {
      redirect(
        "/dashboard/share?error=" + encodeURIComponent("Please log in first")
      );
    }

    // Parse the session to get user info (session cookie is base64 encoded)
    let userId: string;
    try {
      const decoded = Buffer.from(sessionCookie.value, "base64").toString();
      const session = JSON.parse(decoded);

      // Check if session is expired
      if (session.exp && session.exp < Date.now()) {
        redirect(
          "/dashboard/share?error=" + encodeURIComponent("Session expired")
        );
      }

      if (!session.userId) {
        redirect(
          "/dashboard/share?error=" + encodeURIComponent("Invalid session")
        );
      }
      userId = session.userId;
    } catch {
      redirect(
        "/dashboard/share?error=" + encodeURIComponent("Invalid session")
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();

    // Get shared text/URL (might be shared along with images)
    const sharedTitle = formData.get("title") as string | null;
    const sharedText = formData.get("text") as string | null;
    const sharedUrl = formData.get("url") as string | null;

    // Get shared images
    const images = formData.getAll("images") as File[];

    console.log("Share target received:", {
      title: sharedTitle,
      text: sharedText,
      url: sharedUrl,
      imageCount: images.length,
    });

    // If a URL was shared (e.g., sharing a link from browser), process it
    if (sharedUrl && !images.length) {
      // Create a processing entry and trigger URL processing
      const processingContent = await createProcessingContent(
        userId,
        sharedUrl
      );

      // Trigger the process API
      const processUrl = new URL("/api/process", request.url).toString();
      fetch(processUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: processingContent.id,
          socialUrl: sharedUrl,
          platform: "website",
          userId,
          messageText: sharedText || sharedTitle,
        }),
      }).catch(console.error);

      redirect("/dashboard/share?result=success");
    }

    // If images were shared, process them
    if (images.length > 0) {
      const image = images[0]; // Process first image

      // Convert File to buffer
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mimeType = image.type || "image/jpeg";

      console.log("Processing shared image:", {
        name: image.name,
        type: mimeType,
        size: buffer.length,
      });

      // Try to extract EXIF data (will work for JPEGs with metadata!)
      const exif = extractExifData(buffer, mimeType);

      let locationString: string | undefined;
      if (exif.latitude && exif.longitude) {
        locationString = formatGpsCoordinates(exif.latitude, exif.longitude);
        console.log("Found GPS in shared image:", locationString);
      }

      // Create a placeholder URL for the content
      const placeholderUrl = `share://image/${Date.now()}`;

      // Create processing entry
      const processingContent = await createProcessingContent(
        userId,
        placeholderUrl
      );

      // Upload the image as thumbnail
      let persistentThumbnailUrl: string | undefined;
      try {
        const supabase = createServerClient();
        const fileName = `${processingContent.id}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("thumbnails")
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("thumbnails")
            .getPublicUrl(fileName);
          persistentThumbnailUrl = urlData.publicUrl;
        }
      } catch (err) {
        console.error("Failed to upload thumbnail:", err);
      }

      // Combine any shared text as context
      const messageContext = [sharedTitle, sharedText, sharedUrl]
        .filter(Boolean)
        .join(" - ");

      // Analyze the image
      const analysisResult = await analyzeImage(base64, mimeType, {
        gpsCoordinates:
          exif.latitude && exif.longitude
            ? { latitude: exif.latitude, longitude: exif.longitude }
            : undefined,
        locationString,
        dateTaken: exif.dateTaken,
        messageText: messageContext || undefined,
      });

      // Save the result
      if (analysisResult.items && analysisResult.items.length > 0) {
        if (analysisResult.isMultiItem && analysisResult.items.length > 1) {
          // Multi-item: create separate entries
          await deleteContent(processingContent.id, userId);

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

            if (item.suggested_tags?.length) {
              try {
                const tags = await getOrCreateTags(userId, item.suggested_tags);
                await addTagsToContent(
                  content.id,
                  tags.map((t) => t.id)
                );
              } catch {}
            }
          }

          // Send push notification for multi-item
          if (createdContents.length > 0) {
            try {
              const firstItem = createdContents[0];
              const notificationTitle =
                createdContents.length > 1
                  ? `${firstItem.title} (+${createdContents.length - 1} more)`
                  : firstItem.title;
              await notifyContentReady(
                userId,
                firstItem.id,
                notificationTitle,
                firstItem.category
              );
            } catch {}
          }
        } else {
          // Single item: update the processing entry
          const item = analysisResult.items[0];
          await updateContent(processingContent.id, {
            category: item.category,
            title: item.title,
            data: item.data,
            thumbnail_url: persistentThumbnailUrl,
            status: "completed",
          });

          if (item.suggested_tags?.length) {
            try {
              const tags = await getOrCreateTags(userId, item.suggested_tags);
              await addTagsToContent(
                processingContent.id,
                tags.map((t) => t.id)
              );
            } catch {}
          }

          // Send push notification
          try {
            await notifyContentReady(
              userId,
              processingContent.id,
              item.title,
              item.category
            );
          } catch {}
        }
      }

      redirect("/dashboard/share?result=success");
    }

    // Nothing to process
    redirect(
      "/dashboard/share?error=" + encodeURIComponent("No content to save")
    );
  } catch (error) {
    console.error("Share target error:", error);

    // Check if it's a redirect (Next.js throws on redirect)
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    redirect(
      "/dashboard/share?error=" +
        encodeURIComponent("Failed to process shared content")
    );
  }
}

// Handle GET requests (when user navigates directly)
export async function GET() {
  redirect("/dashboard");
}

