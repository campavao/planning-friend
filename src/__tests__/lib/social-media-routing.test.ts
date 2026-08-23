/**
 * Which backend each platform actually reaches.
 *
 * This exists because of a bug that no other test could have caught: the
 * extractor was taught to handle Instagram, verified against a live reel, and
 * shipped — while `getSocialMediaInfo` still sent every Instagram URL straight
 * to Apify. Both halves worked. Nothing connected them.
 *
 * So these assert the routing, not the extraction: that Instagram is offered to
 * our own extractor first, that Apify is only reached when the extractor
 * declines, and that a reel never costs a billed actor run when we can do it
 * ourselves.
 */

import { getSocialMediaInfo } from "@/lib/social-media";

const tryExtractor = jest.fn();
const getInstagramMediaInfo = jest.fn();

jest.mock("@/lib/extractor", () => ({
  ...jest.requireActual("@/lib/extractor"),
  tryExtractor: (url: string) => tryExtractor(url),
}));

jest.mock("@/lib/instagram", () => ({
  ...jest.requireActual("@/lib/instagram"),
  getInstagramMediaInfo: (url: string) => getInstagramMediaInfo(url),
}));

const REEL = "https://www.instagram.com/reel/DcHS0FGpjKW/";

beforeEach(() => {
  tryExtractor.mockReset();
  getInstagramMediaInfo.mockReset();
});

describe("Instagram routing", () => {
  it("uses the self-hosted extractor and never touches Apify", async () => {
    tryExtractor.mockResolvedValue({
      videoUrl: "https://app.vercel.app/api/extract?url=x&mode=video",
      videoHeaders: { "x-extractor-secret": "s" },
      thumbnailUrl: "https://cdn/thumb.jpg",
      description: "Just a few things lotad can hold for you.",
      author: "Victoria Tran",
      originalUrl: REEL,
    });

    const info = await getSocialMediaInfo(REEL);

    expect(tryExtractor).toHaveBeenCalledWith(REEL);
    // The whole point: a reel we can extract ourselves must not be billed.
    expect(getInstagramMediaInfo).not.toHaveBeenCalled();
    expect(info.platform).toBe("instagram");
    expect(info.author).toBe("Victoria Tran");
    expect(info.videoHeaders).toEqual({ "x-extractor-secret": "s" });
  });

  it("falls back to Apify when the extractor declines", async () => {
    // Carousels are the real case: they render client-side, so yt-dlp finds
    // no formats and Apify is still the only thing that can read them.
    tryExtractor.mockResolvedValue(null);
    getInstagramMediaInfo.mockResolvedValue({
      videoUrl: "https://scontent/v.mp4",
      thumbnailUrl: "https://scontent/t.jpg",
      description: "carousel",
      author: "someone",
      originalUrl: REEL,
    });

    const info = await getSocialMediaInfo(REEL);

    expect(getInstagramMediaInfo).toHaveBeenCalledWith(REEL);
    expect(info.description).toBe("carousel");
  });

  it("carries the slides through when the extractor returns images", async () => {
    tryExtractor.mockResolvedValue({
      imageUrls: ["https://cdn/1.jpg", "https://cdn/2.jpg"],
      imageHeaders: { Referer: "https://www.instagram.com/" },
      description: "",
      originalUrl: REEL,
    });

    const info = await getSocialMediaInfo(REEL);

    expect(info.imageUrls).toHaveLength(2);
    expect(getInstagramMediaInfo).not.toHaveBeenCalled();
  });
});
