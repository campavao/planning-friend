/**
 * @jest-environment jsdom
 */

import { fetcher, clearSWRCache } from "@/lib/swr-config";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
  // Reset fetch mock
  global.fetch = jest.fn();
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
    localStorageMock.setItem("planning-friend-cache-v1", "some-data");

    clearSWRCache();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "planning-friend-cache-v1"
    );
  });

  it("does not throw when localStorage is empty", () => {
    expect(() => clearSWRCache()).not.toThrow();
  });
});
