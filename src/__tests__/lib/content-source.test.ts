import {
  createImageSourceUrl,
  isImageSourcedItem,
} from "@/lib/content-source";

// ============================================
// isImageSourcedItem
// ============================================
describe("isImageSourcedItem", () => {
  it("recognizes the MMS image placeholder written by the Twilio webhook", () => {
    expect(isImageSourcedItem("mms://image/1712345678901")).toBe(true);
  });

  it("recognizes whatever createImageSourceUrl produces", () => {
    expect(isImageSourcedItem(createImageSourceUrl())).toBe(true);
  });

  it("rejects TikTok URLs", () => {
    expect(isImageSourcedItem("https://www.tiktok.com/@user/video/123")).toBe(
      false
    );
    expect(isImageSourcedItem("https://vm.tiktok.com/ZMabc123/")).toBe(false);
  });

  it("rejects Instagram URLs", () => {
    expect(isImageSourcedItem("https://www.instagram.com/reel/Cabc123/")).toBe(
      false
    );
    expect(isImageSourcedItem("https://instagr.am/p/Cabc123/")).toBe(false);
  });

  it("rejects websites and other schemes", () => {
    expect(isImageSourcedItem("https://www.allrecipes.com/recipe/123")).toBe(
      false
    );
    expect(isImageSourcedItem("mms://video/1712345678901")).toBe(false);
  });

  it("only matches the placeholder at the start of the URL", () => {
    expect(isImageSourcedItem("https://example.com/mms://image/123")).toBe(
      false
    );
  });

  it("handles empty, null and undefined input", () => {
    expect(isImageSourcedItem("")).toBe(false);
    expect(isImageSourcedItem(null)).toBe(false);
    expect(isImageSourcedItem(undefined)).toBe(false);
  });
});

// ============================================
// createImageSourceUrl
// ============================================
describe("createImageSourceUrl", () => {
  it("stamps the current time so each message gets its own placeholder", () => {
    jest.spyOn(Date, "now").mockReturnValue(1712345678901);
    expect(createImageSourceUrl()).toBe("mms://image/1712345678901");
    jest.restoreAllMocks();
  });
});
