"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  Content,
  ContentCategory,
  PlanItem,
  WeeklyPlanWithItems,
  SharedPlanItem,
} from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CATEGORY_EMOJI: Record<string, string> = {
  meal: "🍽️",
  event: "🎉",
  date_idea: "💕",
  other: "📌",
};

// Extended plan item with sharing info from API
interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  shared_with?: { userId: string; name: string }[];
}

// Extended plan type
interface WeeklyPlanWithSharingItems
  extends Omit<WeeklyPlanWithItems, "items"> {
  items: PlanItemWithSharing[];
}

// Friend that can be shared with (has a linked account)
interface ShareableFriend {
  id: string;
  name: string;
  linkedUserId: string;
  isFavorite: boolean;
}

interface PlannerData {
  plan: WeeklyPlanWithSharingItems | null;
  sharedItems: SharedPlanItem[];
  availableContent: Content[];
  suggestions: Record<number, Content[]>;
  shareableFriends: ShareableFriend[];
}

interface ItemShareState {
  isOpen: boolean;
  itemId: string | null;
  itemTitle: string;
  selectedFriendIds: string[];
  loading: boolean;
  error: string;
  success: string;
  showAddFriend: boolean;
  newFriendName: string;
  newFriendPhone: string;
}

export default function PlannerPage() {
  const [data, setData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<string>("");
  const [addingToDay, setAddingToDay] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | "all">(
    "all"
  );
  const [itemShare, setItemShare] = useState<ItemShareState>({
    isOpen: false,
    itemId: null,
    itemTitle: "",
    selectedFriendIds: [],
    loading: false,
    error: "",
    success: "",
    showAddFriend: false,
    newFriendName: "",
    newFriendPhone: "",
  });
  const router = useRouter();

  // Get last shared friend from localStorage for convenience
  const getLastSharedFriendIds = (): string[] => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("lastSharedFriendIds");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveLastSharedFriendIds = (friendIds: string[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("lastSharedFriendIds", JSON.stringify(friendIds));
    } catch {
      // Ignore storage errors
    }
  };

  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    return monday.toISOString().split("T")[0];
  };

  const fetchPlanner = useCallback(
    async (week?: string) => {
      try {
        const targetWeek = week || weekStart || getCurrentWeekStart();
        const res = await fetch(`/api/planner?week=${targetWeek}`);
        const result = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/");
            return;
          }
          throw new Error(result.error);
        }

        setData(result);
        setWeekStart(targetWeek);
      } catch (error) {
        console.error("Failed to fetch planner:", error);
      } finally {
        setLoading(false);
      }
    },
    [router, weekStart]
  );

  useEffect(() => {
    const week = getCurrentWeekStart();
    setWeekStart(week);
    fetchPlanner(week);
  }, []);

  const navigateWeek = (direction: number) => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() + direction * 7);
    const newWeek = current.toISOString().split("T")[0];
    setWeekStart(newWeek);
    setLoading(true);
    fetchPlanner(newWeek);
  };

  const addToDay = async (contentId: string, dayOfWeek: number) => {
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, contentId, dayOfWeek }),
      });

      if (res.ok) {
        fetchPlanner(weekStart);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
    setAddingToDay(null);
    setSearchQuery("");
    setCategoryFilter("all");
  };

  const removeFromDay = async (itemId: string) => {
    try {
      const res = await fetch(`/api/planner/item?id=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPlanner(weekStart);
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  // Open share modal for an item
  const openShareModal = (item: PlanItemWithSharing) => {
    // Pre-select friends that are already shared with, or use last shared
    const currentlySharedUserIds = item.shared_with?.map((s) => s.userId) || [];
    let preSelectedFriendIds: string[] = [];

    if (currentlySharedUserIds.length > 0) {
      // Map user IDs back to friend IDs
      preSelectedFriendIds =
        data?.shareableFriends
          .filter((f) => currentlySharedUserIds.includes(f.linkedUserId))
          .map((f) => f.id) || [];
    } else {
      // Use last shared friends if no current shares
      preSelectedFriendIds = getLastSharedFriendIds();
    }

    setItemShare({
      isOpen: true,
      itemId: item.id,
      itemTitle: item.content?.title || "Item",
      selectedFriendIds: preSelectedFriendIds,
      loading: false,
      error: "",
      success: "",
      showAddFriend: false,
      newFriendName: "",
      newFriendPhone: "",
    });
  };

  // Share item with selected friends
  const shareItem = async () => {
    if (!itemShare.itemId || itemShare.selectedFriendIds.length === 0) return;

    setItemShare((s) => ({ ...s, loading: true, error: "", success: "" }));
    try {
      const res = await fetch("/api/planner/item/share", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: itemShare.itemId,
          friendIds: itemShare.selectedFriendIds,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // Save last shared friends for convenience
      saveLastSharedFriendIds(itemShare.selectedFriendIds);

      setItemShare((s) => ({
        ...s,
        loading: false,
        success: `Shared with ${result.sharedWith} friend${
          result.sharedWith !== 1 ? "s" : ""
        }!`,
      }));

      // Refresh to show updated share status
      fetchPlanner(weekStart);

      // Close modal after a short delay
      setTimeout(() => {
        setItemShare((s) => ({ ...s, isOpen: false }));
      }, 1500);
    } catch (error) {
      setItemShare((s) => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to share",
      }));
    }
  };

  // Leave a shared item
  const leaveSharedItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/planner/item/share?itemId=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPlanner(weekStart);
      }
    } catch (error) {
      console.error("Failed to leave shared item:", error);
    }
  };

  // Add a new friend
  const addNewFriend = async () => {
    if (!itemShare.newFriendName.trim()) return;

    setItemShare((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: itemShare.newFriendName.trim(),
          phoneNumber: itemShare.newFriendPhone.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // Refresh the planner data to get updated friends list
      await fetchPlanner(weekStart);

      // If the friend has a linked account, pre-select them
      if (result.friend?.linked_user_id) {
        setItemShare((s) => ({
          ...s,
          loading: false,
          showAddFriend: false,
          newFriendName: "",
          newFriendPhone: "",
          selectedFriendIds: [...s.selectedFriendIds, result.friend.id],
        }));
      } else {
        setItemShare((s) => ({
          ...s,
          loading: false,
          showAddFriend: false,
          newFriendName: "",
          newFriendPhone: "",
          error:
            "Friend added, but they need to sign up for Planning Friend to receive shares.",
        }));
      }
    } catch (error) {
      setItemShare((s) => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to add friend",
      }));
    }
  };

  // Toggle friend selection
  const toggleFriendSelection = (friendId: string) => {
    setItemShare((s) => ({
      ...s,
      selectedFriendIds: s.selectedFriendIds.includes(friendId)
        ? s.selectedFriendIds.filter((id) => id !== friendId)
        : [...s.selectedFriendIds, friendId],
    }));
  };

  const formatWeekRange = () => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const isCurrentWeek = () => weekStart === getCurrentWeekStart();

  const getDateForDay = (dayIndex: number) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return date.getDate();
  };

  const isToday = (dayIndex: number) => {
    const today = new Date();
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    return today.toDateString() === dayDate.toDateString();
  };

  // Filter content for the picker (exclude gift_idea from planner)
  const getFilteredContent = () => {
    if (!data?.availableContent) return [];

    const usedIds = new Set(data.plan?.items.map((i) => i.content_id) || []);

    return data.availableContent.filter((c) => {
      if (usedIds.has(c.id)) return false;
      if (c.category === "gift_idea") return false; // Exclude gifts from planner
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return c.title.toLowerCase().includes(query);
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-shimmer w-16 h-16 rounded-full" />
      </div>
    );
  }

  // Combine own items and shared items by day
  type DisplayItem = (PlanItemWithSharing | SharedPlanItem) & {
    isSharedWithMe?: boolean;
  };

  const itemsByDay: Record<number, DisplayItem[]> = {};
  for (let i = 0; i <= 6; i++) {
    // Own items
    const ownItems: DisplayItem[] = (
      data?.plan?.items.filter((item) => item.day_of_week === i) || []
    ).map((item) => ({ ...item, isSharedWithMe: false }));

    // Shared items for this day
    const sharedItems: DisplayItem[] = (
      data?.sharedItems?.filter((item) => item.day_of_week === i) || []
    ).map((item) => ({ ...item, isSharedWithMe: true }));

    itemsByDay[i] = [...ownItems, ...sharedItems];
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-paper">
      {/* Scrapbook Header */}
      <div className="pt-6 pb-4 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-washi-mint/20"
            >
              ← Back
            </Button>
          </Link>
          <div className="relative">
            <h1 className="font-handwritten text-3xl md:text-4xl text-foreground transform -rotate-1">
              Weekly Plan
            </h1>
            <div className="absolute -bottom-1 left-0 right-0 h-2 bg-washi-blue/60 transform rotate-0.5 -z-10" />
          </div>
          {/* Placeholder for symmetry */}
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-4">
        {/* Week Navigation */}
        <div className="scrapbook-card p-3 md:p-4 mb-4 md:mb-6 flex items-center justify-between relative">
          <div className="absolute -top-2 left-8 w-14 h-5 bg-washi-yellow/80 transform -rotate-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek(-1)}
            className="px-2 md:px-3"
          >
            ← <span className="hidden sm:inline ml-1">Prev</span>
          </Button>
          <div className="text-center relative">
            <h2 className="text-base md:text-xl font-semibold font-handwritten">
              {formatWeekRange()}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              {isCurrentWeek() && (
                <span className="sticker sticker-event text-[10px]">
                  This Week
                </span>
              )}
              {/* Shared items indicator */}
              {data?.sharedItems && data.sharedItems.length > 0 && (
                <span className="sticker sticker-date_idea text-[10px]">
                  🤝 {data.sharedItems.length} shared
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek(1)}
            className="px-2 md:px-3"
          >
            <span className="hidden sm:inline mr-1">Next</span> →
          </Button>
        </div>

        {/* Week Grid - Vertical on mobile, horizontal on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAYS.map((day, dayIndex) => (
            <Card
              key={day}
              className={`glass overflow-hidden ${
                isToday(dayIndex)
                  ? "border-primary/50 ring-2 ring-primary/20"
                  : ""
              }`}
            >
              {/* Mobile Layout - Horizontal with prominent item */}
              <div className="md:hidden">
                <div className="p-3">
                  {/* Compact Day Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">
                        {getDateForDay(dayIndex)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {DAYS_FULL[dayIndex]}
                      </span>
                      {isToday(dayIndex) && (
                        <Badge variant="secondary" className="text-xs">
                          Today
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setAddingToDay(dayIndex)}
                    >
                      + Add
                    </Button>
                  </div>

                  {/* Prominent Items */}
                  {itemsByDay[dayIndex].length > 0 ? (
                    <div className="space-y-2">
                      {itemsByDay[dayIndex].map((item) => {
                        const isShared = item.isSharedWithMe;
                        const sharedItem = isShared
                          ? (item as SharedPlanItem)
                          : null;
                        const ownItem = !isShared
                          ? (item as PlanItemWithSharing)
                          : null;

                        return (
                          <div
                            key={item.id}
                            className={`group relative glass rounded-xl overflow-hidden ${
                              isShared
                                ? "border-2 border-washi-pink/50 bg-washi-pink/5"
                                : ""
                            }`}
                          >
                            <Link
                              href={`/dashboard/${item.content_id}`}
                              className="flex gap-3"
                            >
                              {item.content?.thumbnail_url && (
                                <img
                                  src={item.content.thumbnail_url}
                                  alt=""
                                  className="w-20 h-20 object-cover shrink-0"
                                />
                              )}
                              <div className="flex-1 py-2 pr-16 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-sm">
                                    {
                                      CATEGORY_EMOJI[
                                        item.content?.category || "other"
                                      ]
                                    }
                                  </span>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {item.content?.category?.replace("_", " ")}
                                  </span>
                                  {isShared && (
                                    <span className="text-[10px] bg-washi-pink/30 px-1.5 py-0.5 rounded">
                                      from {sharedItem?.owner_name}
                                    </span>
                                  )}
                                  {ownItem?.shared_with &&
                                    ownItem.shared_with.length > 0 && (
                                      <span className="text-[10px] bg-washi-mint/30 px-1.5 py-0.5 rounded">
                                        🤝 {ownItem.shared_with.length}
                                      </span>
                                    )}
                                </div>
                                <p className="font-medium text-sm line-clamp-2">
                                  {item.content?.title}
                                </p>
                              </div>
                            </Link>
                            {/* Action buttons */}
                            <div className="absolute top-2 right-2 flex gap-1">
                              {isShared ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    leaveSharedItem(item.id);
                                  }}
                                  className="bg-secondary/90 text-secondary-foreground rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-md"
                                  title="Leave"
                                >
                                  👋
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openShareModal(ownItem!);
                                    }}
                                    className="bg-washi-mint/90 text-foreground rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-md"
                                    title="Share"
                                  >
                                    🤝
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      removeFromDay(item.id);
                                    }}
                                    className="bg-destructive/90 text-destructive-foreground rounded-full w-7 h-7 text-sm flex items-center justify-center shadow-md"
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : data?.suggestions?.[dayIndex]?.[0] ? (
                    <button
                      onClick={() =>
                        addToDay(data.suggestions[dayIndex][0].id, dayIndex)
                      }
                      className="w-full glass rounded-xl overflow-hidden border border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex gap-3">
                        {data.suggestions[dayIndex][0].thumbnail_url && (
                          <img
                            src={data.suggestions[dayIndex][0].thumbnail_url}
                            alt=""
                            className="w-16 h-16 object-cover shrink-0 opacity-60"
                          />
                        )}
                        <div className="flex-1 py-2 pr-3 min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">
                            Suggested
                          </p>
                          <p className="text-sm line-clamp-2 text-muted-foreground">
                            {data.suggestions[dayIndex][0].title}
                          </p>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No plans yet
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop Layout - Vertical card with prominent item */}
              <div className="hidden md:block">
                {/* Compact Day Header */}
                <div className="px-3 pt-3 pb-2 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-primary">
                        {getDateForDay(dayIndex)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {DAYS[dayIndex]}
                      </span>
                    </div>
                    {isToday(dayIndex) && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        Today
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-2 space-y-2 min-h-[180px]">
                  {/* Prominent Items */}
                  {itemsByDay[dayIndex].map((item) => {
                    const isShared = item.isSharedWithMe;
                    const sharedItem = isShared
                      ? (item as SharedPlanItem)
                      : null;
                    const ownItem = !isShared
                      ? (item as PlanItemWithSharing)
                      : null;

                    return (
                      <div
                        key={item.id}
                        className={`group relative glass rounded-lg overflow-hidden ${
                          isShared
                            ? "border-2 border-washi-pink/50 bg-washi-pink/5"
                            : ""
                        }`}
                      >
                        <Link
                          href={`/dashboard/${item.content_id}`}
                          className="block"
                        >
                          {item.content?.thumbnail_url && (
                            <img
                              src={item.content.thumbnail_url}
                              alt=""
                              className="w-full h-24 object-cover"
                            />
                          )}
                          <div className="p-2">
                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                              <span className="text-xs">
                                {
                                  CATEGORY_EMOJI[
                                    item.content?.category || "other"
                                  ]
                                }
                              </span>
                              {isShared && (
                                <span className="text-[8px] bg-washi-pink/30 px-1 py-0.5 rounded">
                                  {sharedItem?.owner_name}
                                </span>
                              )}
                              {ownItem?.shared_with &&
                                ownItem.shared_with.length > 0 && (
                                  <span className="text-[8px] bg-washi-mint/30 px-1 py-0.5 rounded">
                                    🤝 {ownItem.shared_with.length}
                                  </span>
                                )}
                            </div>
                            <p className="text-xs font-medium line-clamp-2">
                              {item.content?.title}
                            </p>
                          </div>
                        </Link>
                        {/* Action buttons */}
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isShared ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                leaveSharedItem(item.id);
                              }}
                              className="bg-secondary/90 text-secondary-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center"
                              title="Leave"
                            >
                              👋
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openShareModal(ownItem!);
                                }}
                                className="bg-washi-mint/90 text-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center"
                                title="Share"
                              >
                                🤝
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeFromDay(item.id);
                                }}
                                className="bg-destructive/90 text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Suggestion */}
                  {itemsByDay[dayIndex].length === 0 &&
                    data?.suggestions?.[dayIndex]?.[0] && (
                      <button
                        onClick={() =>
                          addToDay(data.suggestions[dayIndex][0].id, dayIndex)
                        }
                        className="w-full glass rounded-lg overflow-hidden border border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        {data.suggestions[dayIndex][0].thumbnail_url && (
                          <img
                            src={data.suggestions[dayIndex][0].thumbnail_url}
                            alt=""
                            className="w-full h-16 object-cover opacity-50"
                          />
                        )}
                        <div className="p-2">
                          <p className="text-[10px] text-muted-foreground">
                            Suggested
                          </p>
                          <p className="text-xs line-clamp-2 text-muted-foreground">
                            {data.suggestions[dayIndex][0].title}
                          </p>
                        </div>
                      </button>
                    )}

                  {/* Add Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs border border-dashed"
                    onClick={() => setAddingToDay(dayIndex)}
                  >
                    +
                  </Button>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {data?.availableContent.length === 0 && (
          <div className="glass rounded-2xl p-6 md:p-8 mt-6 text-center">
            <p className="text-lg md:text-xl mb-2">No saved content yet!</p>
            <p className="text-sm text-muted-foreground mb-4">
              Text TikTok or Instagram links to save meals, events, and date
              ideas.
            </p>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {addingToDay !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="glass w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Add to {DAYS_FULL[addingToDay]}</h3>
              <button
                onClick={() => {
                  setAddingToDay(null);
                  setSearchQuery("");
                  setCategoryFilter("all");
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>

            {/* Search & Filters */}
            <div className="p-4 border-b border-border space-y-3">
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                autoFocus
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  variant={categoryFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("all")}
                  className="shrink-0"
                >
                  All
                </Button>
                <Button
                  variant={categoryFilter === "meal" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("meal")}
                  className="shrink-0"
                >
                  Meals
                </Button>
                <Button
                  variant={categoryFilter === "event" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("event")}
                  className="shrink-0"
                >
                  Events
                </Button>
                <Button
                  variant={categoryFilter === "date_idea" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("date_idea")}
                  className="shrink-0"
                >
                  Dates
                </Button>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {getFilteredContent().map((content) => (
                <button
                  key={content.id}
                  onClick={() => addToDay(content.id, addingToDay)}
                  className="w-full glass rounded-xl p-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3"
                >
                  {content.thumbnail_url && (
                    <img
                      src={content.thumbnail_url}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{CATEGORY_EMOJI[content.category]}</span>
                      <span className="text-sm font-medium line-clamp-1">
                        {content.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {content.category.replace("_", " ")}
                    </p>
                  </div>
                </button>
              ))}

              {getFilteredContent().length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No items found</p>
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="mt-2"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Share Modal */}
      {itemShare.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div>
                <h2 className="text-lg font-semibold">Share Item</h2>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {itemShare.itemTitle}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItemShare((s) => ({ ...s, isOpen: false }))}
              >
                ×
              </Button>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!itemShare.showAddFriend ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select friends to share this item with. They&apos;ll see it
                    on their calendar.
                  </p>

                  {data?.shareableFriends &&
                  data.shareableFriends.length > 0 ? (
                    <>
                      {data.shareableFriends.map((friend) => {
                        const isSelected = itemShare.selectedFriendIds.includes(
                          friend.id
                        );
                        return (
                          <button
                            key={friend.id}
                            onClick={() => toggleFriendSelection(friend.id)}
                            className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-colors ${
                              isSelected
                                ? "bg-primary/10 border-2 border-primary/50"
                                : "bg-secondary/30 hover:bg-secondary/50 border-2 border-transparent"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                isSelected
                                  ? "bg-primary/20"
                                  : "bg-washi-mint/30"
                              }`}
                            >
                              {friend.isFavorite ? "⭐" : "👤"}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {friend.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {isSelected ? "Selected" : "Tap to select"}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="text-primary">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm mb-2">
                        No friends with linked accounts yet.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Friends need to sign up for Planning Friend to receive
                        shared items.
                      </p>
                    </div>
                  )}

                  {/* Add Friend Button */}
                  <button
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: true }))
                    }
                    className="w-full p-3 rounded-xl text-left flex items-center gap-3 bg-secondary/20 hover:bg-secondary/40 transition-colors border-2 border-dashed border-border"
                  >
                    <div className="w-10 h-10 rounded-full bg-washi-yellow/30 flex items-center justify-center text-lg">
                      +
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Add a Friend</p>
                      <p className="text-xs text-muted-foreground">
                        Add someone new to share with
                      </p>
                    </div>
                  </button>
                </>
              ) : (
                /* Add Friend Form */
                <div className="space-y-4">
                  <button
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: false }))
                    }
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back to friends
                  </button>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Name
                      </label>
                      <Input
                        value={itemShare.newFriendName}
                        onChange={(e) =>
                          setItemShare((s) => ({
                            ...s,
                            newFriendName: e.target.value,
                          }))
                        }
                        placeholder="Friend's name"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Phone Number{" "}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Input
                        value={itemShare.newFriendPhone}
                        onChange={(e) =>
                          setItemShare((s) => ({
                            ...s,
                            newFriendPhone: e.target.value,
                          }))
                        }
                        placeholder="(555) 123-4567"
                        type="tel"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        If they have Planning Friend, they&apos;ll be linked
                        automatically.
                      </p>
                    </div>

                    <Button
                      onClick={addNewFriend}
                      disabled={
                        itemShare.loading || !itemShare.newFriendName.trim()
                      }
                      className="w-full"
                    >
                      {itemShare.loading ? "Adding..." : "Add Friend"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!itemShare.showAddFriend && (
              <div className="p-4 border-t border-border/50 space-y-3">
                {itemShare.error && (
                  <p className="text-sm text-destructive text-center">
                    {itemShare.error}
                  </p>
                )}
                {itemShare.success && (
                  <p className="text-sm text-primary text-center">
                    {itemShare.success}
                  </p>
                )}
                <Button
                  onClick={shareItem}
                  disabled={
                    itemShare.loading ||
                    itemShare.selectedFriendIds.length === 0
                  }
                  className="w-full"
                >
                  {itemShare.loading
                    ? "Sharing..."
                    : itemShare.selectedFriendIds.length === 0
                    ? "Select friends to share"
                    : `Share with ${itemShare.selectedFriendIds.length} friend${
                        itemShare.selectedFriendIds.length !== 1 ? "s" : ""
                      }`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
