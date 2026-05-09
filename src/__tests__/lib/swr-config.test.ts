/**
 * @jest-environment jsdom
 */

import { fetcher, clearSWRCache } from "@/lib/swr-config";

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================
// fetcher
// ============================================
describe("fetcher", () => {
  it("returns parsed JSON on successful response", async () => {
    const mockData = { content: [{ id: "1", title: "Test" }] };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetcher("/api/content");
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith("/api/content");
  });

  it("throws on non-OK response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(fetcher("/api/content")).rejects.toThrow(
      "An error occurred while fetching the data."
    );
  });

  it("throws on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    await expect(fetcher("/api/content")).rejects.toThrow("Network error");
  });

  it("calls fetch with the provided URL", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await fetcher("/api/planner?week=2024-01-14");
    expect(global.fetch).toHaveBeenCalledWith("/api/planner?week=2024-01-14");
  });
});

// ============================================
// clearSWRCache
// ============================================
describe("clearSWRCache", () => {
  it("removes the cache from localStorage", () => {
    localStorage.setItem("planning-friend-cache-v1", "some-data");
    const spy = jest.spyOn(Storage.prototype, "removeItem");

    clearSWRCache();

    expect(spy).toHaveBeenCalledWith("planning-friend-cache-v1");
  });

  it("does not throw when localStorage is empty", () => {
    expect(() => clearSWRCache()).not.toThrow();
  });
});
