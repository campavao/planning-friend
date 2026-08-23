/**
 * The self-hosted extractor path (PLA-15).
 *
 * What matters here is not that yt-dlp works — the probe measured that — but
 * that the Node side stays honest about it: it must authenticate, it must route
 * the download back through the extractor rather than at TikTok's CDN, and it
 * must fall through to the free methods rather than hard-failing a save when
 * the extractor is unconfigured, unreachable, or cannot handle the post.
 */

import {
  downloadTikTokVideo,
  getTikTokVideoAsBase64,
  getTikTokVideoInfo,
} from "@/lib/tiktok";

const VIDEO_URL = "https://www.tiktok.com/@cook/video/7123456789012345678";

const ORIGINAL_ENV = { ...process.env };

function mockExtractor(payload: unknown, status = 200) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/extract")) {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
      } as unknown as Response;
    }
    // Every other method the chain would try. Rejecting here means a test that
    // expects the extractor to win fails loudly if it silently fell through.
    throw new Error(`unexpected fetch: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    VERCEL_URL: "planning-friend.vercel.app",
    EXTRACTOR_SECRET: "s3cret",
    VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-me",
  };
  delete process.env.RAPIDAPI_KEY;
  delete process.env.EXTRACTOR_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe("getTikTokVideoInfo via the self-hosted extractor", () => {
  it("points the video URL back at the extractor, not at TikTok's CDN", async () => {
    mockExtractor({
      ok: true,
      hasVideo: true,
      thumbnailUrl: "https://cdn.tiktok.com/cover.jpg",
      description: "Miso salmon in 10 minutes",
      author: "cook",
      originalUrl: VIDEO_URL,
    });

    const info = await getTikTokVideoInfo(VIDEO_URL);

    // The CDN URL is bound to the session that negotiated it and 403s everyone
    // else, so the bytes must come back through our own endpoint.
    expect(info.videoUrl).toContain(
      "https://planning-friend.vercel.app/api/extract",
    );
    expect(info.videoUrl).toContain("mode=video");
    expect(info.videoUrl).toContain(encodeURIComponent(VIDEO_URL));
    expect(info.description).toBe("Miso salmon in 10 minutes");
    expect(info.author).toBe("cook");
    expect(info.thumbnailUrl).toBe("https://cdn.tiktok.com/cover.jpg");
  });

  it("carries auth on the video URL so the download can authenticate", async () => {
    mockExtractor({ ok: true, hasVideo: true, description: "x" });

    const info = await getTikTokVideoInfo(VIDEO_URL);

    expect(info.videoHeaders?.["x-extractor-secret"]).toBe("s3cret");
    expect(info.videoHeaders?.["x-vercel-protection-bypass"]).toBe("bypass-me");
  });

  it("offers no video URL when the post has no downloadable format", async () => {
    mockExtractor({ ok: true, hasVideo: false, description: "caption only" });

    const info = await getTikTokVideoInfo(VIDEO_URL);

    // Still useful: the caption is what the thumbnail path analyses.
    expect(info.videoUrl).toBeUndefined();
    expect(info.videoHeaders).toBeUndefined();
    expect(info.description).toBe("caption only");
  });

  it("authenticates and bypasses deployment protection on the metadata call", async () => {
    const fetchMock = mockExtractor({ ok: true, hasVideo: true, description: "x" });

    await getTikTokVideoInfo(VIDEO_URL);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://planning-friend.vercel.app/api/extract");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-extractor-secret"]).toBe("s3cret");
    expect(headers["x-vercel-protection-bypass"]).toBe("bypass-me");
  });

  it("prefers an explicit EXTRACTOR_URL over this deployment", async () => {
    process.env.EXTRACTOR_URL = "https://extractor.example.com/";
    const fetchMock = mockExtractor({ ok: true, hasVideo: true, description: "x" });

    await getTikTokVideoInfo(VIDEO_URL);

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://extractor.example.com/api/extract",
    );
  });

  describe("degradation", () => {
    /** Fails every method after the extractor, so the chain runs to the end. */
    function mockAllFailing(extractorPayload: unknown, status = 200) {
      const fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/extract")) {
          return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => extractorPayload,
          } as unknown as Response;
        }
        throw new Error("offline");
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      return fetchMock;
    }

    it("falls through when the post cannot be extracted", async () => {
      mockAllFailing({ ok: false, outcome: "unsupported", error: "no ext" });

      const info = await getTikTokVideoInfo(VIDEO_URL);

      expect(info.videoUrl).toBeUndefined();
      expect(info.originalUrl).toBe(VIDEO_URL);
      expect(info.description).toContain("7123456789012345678");
    });

    it("falls through on an auth failure rather than throwing", async () => {
      mockAllFailing({ ok: false, error: "unauthorized" }, 401);

      await expect(getTikTokVideoInfo(VIDEO_URL)).resolves.toBeDefined();
    });

    it("skips the extractor entirely when no secret is configured", async () => {
      delete process.env.EXTRACTOR_SECRET;
      const fetchMock = mockAllFailing({ ok: true, hasVideo: true });

      await getTikTokVideoInfo(VIDEO_URL);

      const calledExtractor = fetchMock.mock.calls.some((c) =>
        String(c[0]).includes("/api/extract"),
      );
      expect(calledExtractor).toBe(false);
    });

    it("skips the extractor off-Vercel, so local dev still works", async () => {
      delete process.env.VERCEL_URL;
      const fetchMock = mockAllFailing({ ok: true, hasVideo: true });

      await getTikTokVideoInfo(VIDEO_URL);

      const calledExtractor = fetchMock.mock.calls.some((c) =>
        String(c[0]).includes("/api/extract"),
      );
      expect(calledExtractor).toBe(false);
    });

    it("ignores an ok response carrying nothing usable", async () => {
      mockAllFailing({ ok: true, hasVideo: false, description: "" });

      const info = await getTikTokVideoInfo(VIDEO_URL);

      expect(info.videoUrl).toBeUndefined();
    });
  });
});

describe("downloadTikTokVideo", () => {
  function mockResponse(overrides: Partial<Record<string, unknown>> = {}) {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "video/mp4" },
      arrayBuffer: async () => new ArrayBuffer(4),
      ...overrides,
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;
    return fetchMock as unknown as jest.Mock;
  }

  it("sends the extractor's auth headers", async () => {
    const fetchMock = mockResponse();

    await downloadTikTokVideo("https://planning-friend.vercel.app/api/extract", {
      "x-extractor-secret": "s3cret",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["x-extractor-secret"]).toBe("s3cret");
  });

  it("still works for URLs that need no special headers", async () => {
    const fetchMock = mockResponse();

    await downloadTikTokVideo("https://cdn.example.com/v.mp4");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("Mozilla/5.0");
  });

  it("refuses a JSON error body instead of passing it off as video", async () => {
    // The extractor answers 200 + JSON when it cannot produce a video. Without
    // the content-type guard this would reach Gemini as a corrupt mp4.
    mockResponse({
      headers: { get: () => "application/json" },
      json: async () => ({ ok: false, outcome: "login_required" }),
    });

    await expect(
      downloadTikTokVideo("https://planning-friend.vercel.app/api/extract"),
    ).rejects.toThrow("login_required");
  });
});

describe("getTikTokVideoAsBase64 reuse", () => {
  /** Counts metadata lookups separately from the byte download. */
  function mockBoth() {
    const fetchMock = jest.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.includes("mode=video")) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => "video/mp4" },
            arrayBuffer: async () => new ArrayBuffer(8),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, hasVideo: true, description: "x" }),
        } as unknown as Response;
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  const metadataCalls = (m: jest.Mock) =>
    m.mock.calls.filter(
      (c) =>
        String(c[0]).includes("/api/extract") &&
        !String(c[0]).includes("mode=video"),
    ).length;

  it("does not look the item up again when handed a resolved one", async () => {
    const fetchMock = mockBoth();
    const resolved = await getTikTokVideoInfo(VIDEO_URL);
    expect(metadataCalls(fetchMock)).toBe(1);

    await getTikTokVideoAsBase64(VIDEO_URL, resolved);

    // Still 1: the download reused the lookup instead of repeating it. This is
    // the whole point — a second lookup is a second full yt-dlp run.
    expect(metadataCalls(fetchMock)).toBe(1);
  });

  it("falls back to looking it up when nothing was handed over", async () => {
    const fetchMock = mockBoth();

    await getTikTokVideoAsBase64(VIDEO_URL);

    expect(metadataCalls(fetchMock)).toBe(1);
  });
});
