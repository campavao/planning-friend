"use client";

import { useCallback, useState } from "react";

export interface FriendOption {
  id: string;
  name: string;
  linkedUserId?: string;
}

export function useFriendSelector(
  friends: FriendOption[],
  initialSelectedIds: string[] = []
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );

  const toggle = useCallback((friendId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  }, []);

  const setSelected = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const selected = Array.from(selectedIds);
  const shareableFriends = friends.filter((f) => f.linkedUserId);

  return {
    selectedIds: selected,
    selectedSet: selectedIds,
    toggle,
    setSelected,
    shareableFriends,
  };
}
