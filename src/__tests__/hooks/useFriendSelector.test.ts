/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useFriendSelector } from "@/hooks/useFriendSelector";
import type { FriendOption } from "@/hooks/useFriendSelector";

const friends: FriendOption[] = [
  { id: "1", name: "Alice", linkedUserId: "user-a" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Charlie", linkedUserId: "user-c" },
  { id: "4", name: "Diana" },
];

describe("useFriendSelector", () => {
  it("initializes with no selected friends", () => {
    const { result } = renderHook(() => useFriendSelector(friends));

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.selectedSet.size).toBe(0);
  });

  it("initializes with pre-selected friends", () => {
    const { result } = renderHook(() =>
      useFriendSelector(friends, ["1", "3"])
    );

    expect(result.current.selectedIds).toHaveLength(2);
    expect(result.current.selectedIds).toContain("1");
    expect(result.current.selectedIds).toContain("3");
  });

  it("toggles a friend on", () => {
    const { result } = renderHook(() => useFriendSelector(friends));

    act(() => {
      result.current.toggle("2");
    });

    expect(result.current.selectedIds).toContain("2");
  });

  it("toggles a friend off", () => {
    const { result } = renderHook(() =>
      useFriendSelector(friends, ["1", "2"])
    );

    act(() => {
      result.current.toggle("1");
    });

    expect(result.current.selectedIds).not.toContain("1");
    expect(result.current.selectedIds).toContain("2");
  });

  it("toggle is idempotent (on-off-on)", () => {
    const { result } = renderHook(() => useFriendSelector(friends));

    act(() => {
      result.current.toggle("1");
    });
    expect(result.current.selectedIds).toContain("1");

    act(() => {
      result.current.toggle("1");
    });
    expect(result.current.selectedIds).not.toContain("1");

    act(() => {
      result.current.toggle("1");
    });
    expect(result.current.selectedIds).toContain("1");
  });

  it("setSelected replaces all selections", () => {
    const { result } = renderHook(() =>
      useFriendSelector(friends, ["1"])
    );

    act(() => {
      result.current.setSelected(["3", "4"]);
    });

    expect(result.current.selectedIds).toEqual(
      expect.arrayContaining(["3", "4"])
    );
    expect(result.current.selectedIds).not.toContain("1");
  });

  it("filters shareableFriends to only those with linkedUserId", () => {
    const { result } = renderHook(() => useFriendSelector(friends));

    expect(result.current.shareableFriends).toHaveLength(2);
    expect(result.current.shareableFriends.map((f) => f.name)).toEqual([
      "Alice",
      "Charlie",
    ]);
  });

  it("returns empty shareableFriends when no friends have linkedUserId", () => {
    const noLinkedFriends = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const { result } = renderHook(() =>
      useFriendSelector(noLinkedFriends)
    );

    expect(result.current.shareableFriends).toHaveLength(0);
  });

  it("handles empty friends list", () => {
    const { result } = renderHook(() => useFriendSelector([]));

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.shareableFriends).toEqual([]);
  });

  it("selectedSet is a Set containing the same IDs as selectedIds", () => {
    const { result } = renderHook(() =>
      useFriendSelector(friends, ["1", "3"])
    );

    expect(result.current.selectedSet).toBeInstanceOf(Set);
    expect(result.current.selectedSet.has("1")).toBe(true);
    expect(result.current.selectedSet.has("3")).toBe(true);
    expect(result.current.selectedSet.has("2")).toBe(false);
  });
});
