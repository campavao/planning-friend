// Test the processContent routing logic
// We mock the processors since they have external dependencies

jest.mock("@/lib/processing/image-processor", () => ({
  processImageContent: jest.fn().mockResolvedValue({ success: true, content: { id: "img-1" } }),
}));

jest.mock("@/lib/processing/social-processor", () => ({
  processSocialContent: jest.fn().mockResolvedValue({ success: true, content: { id: "social-1" } }),
}));

import { processContent } from "@/lib/processing/pipeline";
import { processImageContent } from "@/lib/processing/image-processor";
import { processSocialContent } from "@/lib/processing/social-processor";

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================
// processContent - routing
// ============================================
describe("processContent", () => {
  it("returns error when contentId is missing", async () => {
    const result = await processContent({
      contentId: "",
      socialUrl: "https://example.com",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });
    expect(result).toEqual({ error: "Missing required fields" });
  });

  it("returns error when socialUrl is missing", async () => {
    const result = await processContent({
      contentId: "content-1",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });
    expect(result).toEqual({ error: "Missing required fields" });
  });

  it("returns error when userId is missing", async () => {
    const result = await processContent({
      contentId: "content-1",
      socialUrl: "https://example.com",
      userId: "",
      phoneNumber: "+12125551234",
    });
    expect(result).toEqual({ error: "Missing required fields" });
  });

  it("routes image platform to processImageContent", async () => {
    await processContent({
      contentId: "content-1",
      socialUrl: "https://example.com/image.jpg",
      platform: "image",
      userId: "user-1",
      phoneNumber: "+12125551234",
      mmsMedia: { urls: ["https://example.com/img.jpg"], types: ["image/jpeg"] },
      messageText: "Check this out",
    });

    expect(processImageContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      { urls: ["https://example.com/img.jpg"], types: ["image/jpeg"] },
      "Check this out",
      "https://example.com/image.jpg"
    );
    expect(processSocialContent).not.toHaveBeenCalled();
  });

  it("routes tiktok platform to processSocialContent", async () => {
    await processContent({
      contentId: "content-1",
      socialUrl: "https://www.tiktok.com/@user/video/123",
      platform: "tiktok",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });

    expect(processSocialContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      "https://www.tiktok.com/@user/video/123",
      "tiktok",
      undefined
    );
    expect(processImageContent).not.toHaveBeenCalled();
  });

  it("routes instagram platform to processSocialContent", async () => {
    await processContent({
      contentId: "content-1",
      socialUrl: "https://www.instagram.com/reel/abc/",
      platform: "instagram",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });

    expect(processSocialContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      "https://www.instagram.com/reel/abc/",
      "instagram",
      undefined
    );
  });

  it("routes website platform to processSocialContent", async () => {
    await processContent({
      contentId: "content-1",
      socialUrl: "https://allrecipes.com/recipe/123",
      platform: "website",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });

    expect(processSocialContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      "https://allrecipes.com/recipe/123",
      "website",
      undefined
    );
  });

  it("defaults platform to tiktok when not specified", async () => {
    await processContent({
      contentId: "content-1",
      socialUrl: "https://example.com/video",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });

    expect(processSocialContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      "https://example.com/video",
      "tiktok",
      undefined
    );
  });

  it("uses tiktokUrl as fallback when socialUrl is not provided", async () => {
    await processContent({
      contentId: "content-1",
      tiktokUrl: "https://www.tiktok.com/@user/video/456",
      userId: "user-1",
      phoneNumber: "+12125551234",
    });

    expect(processSocialContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      "https://www.tiktok.com/@user/video/456",
      "tiktok",
      undefined
    );
  });

  it("passes mmsMedia to social processor", async () => {
    const mmsMedia = {
      urls: ["https://example.com/video.mp4"],
      types: ["video/mp4"],
    };

    await processContent({
      contentId: "content-1",
      socialUrl: "https://www.tiktok.com/@user/video/123",
      platform: "tiktok",
      userId: "user-1",
      phoneNumber: "+12125551234",
      mmsMedia,
    });

    expect(processSocialContent).toHaveBeenCalledWith(
      "content-1",
      "user-1",
      "https://www.tiktok.com/@user/video/123",
      "tiktok",
      mmsMedia
    );
  });
});
