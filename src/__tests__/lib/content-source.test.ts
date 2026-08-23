import {
  createImageSourceUrl,
  isImageSourcedItem,
  isVideoSourceUrl,
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

// ============================================
// isVideoSourceUrl
// ============================================
describe("isVideoSourceUrl", () => {
  it("recognizes TikTok, including the short domains", () => {
    expect(isVideoSourceUrl("https://www.tiktok.com/@user/video/123")).toBe(
      true
    );
    expect(isVideoSourceUrl("https://vm.tiktok.com/ZMabc123/")).toBe(true);
    expect(isVideoSourceUrl("https://vt.tiktok.com/ZSabc123/")).toBe(true);
  });

  it("recognizes Instagram and the other video hosts", () => {
    expect(isVideoSourceUrl("https://www.instagram.com/reel/Cabc123/")).toBe(
      true
    );
    expect(isVideoSourceUrl("https://instagr.am/p/Cabc123/")).toBe(true);
    expect(isVideoSourceUrl("https://youtu.be/abc123")).toBe(true);
    expect(isVideoSourceUrl("https://www.youtube.com/shorts/abc123")).toBe(
      true
    );
    expect(isVideoSourceUrl("https://fb.watch/abc123/")).toBe(true);
  });

  it("rejects ordinary websites", () => {
    expect(isVideoSourceUrl("https://www.allrecipes.com/recipe/123")).toBe(
      false
    );
    expect(isVideoSourceUrl("https://lobsterfest.com")).toBe(false);
  });

  it("is not fooled by a video domain elsewhere in the URL", () => {
    expect(isVideoSourceUrl("https://example.com/tiktok.com/video/1")).toBe(
      false
    );
    expect(isVideoSourceUrl("https://nottiktok.com/video/1")).toBe(false);
  });

  it("rejects texted-in photos and unparseable input", () => {
    expect(isVideoSourceUrl(createImageSourceUrl())).toBe(false);
    expect(isVideoSourceUrl("not a url")).toBe(false);
    expect(isVideoSourceUrl("")).toBe(false);
    expect(isVideoSourceUrl(null)).toBe(false);
    expect(isVideoSourceUrl(undefined)).toBe(false);
  });
});
