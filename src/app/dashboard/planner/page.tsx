"use client";

import { TagFilter } from "@/components/tag-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  Content,
  ContentCategory,
  DrinkData,
  MealData,
  PlanItem,
  SharedPlanItem,
  Tag,
  WeeklyPlanWithItems,
} from "@/lib/supabase";
import { formatDateString, parseDateString } from "@/lib/utils";
import html2canvas from "html2canvas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  drink: "🍹",
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

// Content with tags for filtering
interface ContentWithTags extends Content {
  tags?: Tag[];
}

interface PlannerData {
  plan: WeeklyPlanWithSharingItems | null;
  sharedItems: SharedPlanItem[];
  availableContent: ContentWithTags[];
  suggestions: Record<number, Content[]>;
  shareableFriends: ShareableFriend[];
  allTags?: Tag[];
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

// Grocery list types (from Gemini AI)
interface GroceryItem {
  ingredient: string;
  quantity?: string;
  category: string;
  sources: { id: string; title: string }[];
  notes?: string;
}

interface GroceryListState {
  isOpen: boolean;
  items: GroceryItem[];
  tips: string[];
  expandedIngredient: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

// Persistent filter state keys
const FILTER_STORAGE_KEY = "planner_item_filter";

function getStoredFilters(): {
  searchQuery: string;
  categoryFilter: ContentCategory | "all";
  selectedTagIds: string[];
} {
  if (typeof window === "undefined")
    return { searchQuery: "", categoryFilter: "all", selectedTagIds: [] };
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return stored
      ? JSON.parse(stored)
      : { searchQuery: "", categoryFilter: "all", selectedTagIds: [] };
  } catch {
    return { searchQuery: "", categoryFilter: "all", selectedTagIds: [] };
  }
}

function saveFilters(filters: {
  searchQuery: string;
  categoryFilter: ContentCategory | "all";
  selectedTagIds: string[];
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
}

function PlannerContent() {
  const [weekCache, setWeekCache] = useState<Map<string, PlannerData>>(
    new Map()
  );
  const [data, setData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<string>("");
  const [addingToDay, setAddingToDay] = useState<number | null>(null);

  // Persistent filter state
  const storedFilters = useMemo(() => getStoredFilters(), []);
  const [searchQuery, setSearchQuery] = useState(storedFilters.searchQuery);
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | "all">(
    storedFilters.categoryFilter
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    storedFilters.selectedTagIds
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

  // Grocery list state
  const [groceryList, setGroceryList] = useState<GroceryListState>({
    isOpen: false,
    items: [],
    tips: [],
    expandedIngredient: null,
    loading: false,
    saving: false,
    error: null,
  });
  const groceryListRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Save filters when they change
  useEffect(() => {
    saveFilters({ searchQuery, categoryFilter, selectedTagIds });
  }, [searchQuery, categoryFilter, selectedTagIds]);

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
    monday.setHours(0, 0, 0, 0);
    return formatDateString(monday);
  };

  const fetchPlanner = useCallback(
    async (week: string, useCache = true) => {
      // Check cache first
      if (useCache && weekCache.has(week)) {
        setData(weekCache.get(week)!);
        setWeekStart(week);
        setGridLoading(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/planner?week=${week}`);
        const result = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/");
            return;
          }
          throw new Error(result.error);
        }

        // Update cache
        setWeekCache((prev) => new Map(prev).set(week, result));
        setData(result);
        setWeekStart(week);
      } catch (error) {
        console.error("Failed to fetch planner:", error);
      } finally {
        setLoading(false);
        setGridLoading(false);
      }
    },
    [router, weekCache]
  );

  // Invalidate cache for current week when data changes
  const invalidateCache = useCallback((week: string) => {
    setWeekCache((prev) => {
      const newCache = new Map(prev);
      newCache.delete(week);
      return newCache;
    });
  }, []);

  useEffect(() => {
    // Check URL for week parameter first
    const urlWeek = searchParams.get("week");
    const week = urlWeek || getCurrentWeekStart();
    setWeekStart(week);
    fetchPlanner(week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateWeek = (direction: number) => {
    const current = parseDateString(weekStart);
    current.setDate(current.getDate() + direction * 7);
    const newWeek = formatDateString(current);

    // Update URL without full page refresh
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("week", newWeek);
    window.history.pushState({}, "", newUrl.toString());

    setWeekStart(newWeek);
    setGridLoading(true);
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
        invalidateCache(weekStart);
        fetchPlanner(weekStart, false);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
    setAddingToDay(null);
  };

  const removeFromDay = async (itemId: string) => {
    try {
      const res = await fetch(`/api/planner/item?id=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        invalidateCache(weekStart);
        fetchPlanner(weekStart, false);
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  // Open share modal for an item
  const openShareModal = (item: PlanItemWithSharing) => {
    const currentlySharedUserIds = item.shared_with?.map((s) => s.userId) || [];
    let preSelectedFriendIds: string[] = [];

    if (currentlySharedUserIds.length > 0) {
      preSelectedFriendIds =
        data?.shareableFriends
          .filter((f) => currentlySharedUserIds.includes(f.linkedUserId))
          .map((f) => f.id) || [];
    } else {
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

      saveLastSharedFriendIds(itemShare.selectedFriendIds);

      setItemShare((s) => ({
        ...s,
        loading: false,
        success: `Shared with ${result.sharedWith} friend${
          result.sharedWith !== 1 ? "s" : ""
        }!`,
      }));

      invalidateCache(weekStart);
      fetchPlanner(weekStart, false);

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
        invalidateCache(weekStart);
        fetchPlanner(weekStart, false);
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

      invalidateCache(weekStart);
      await fetchPlanner(weekStart, false);

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
    if (!weekStart) return "";
    const start = parseDateString(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const isCurrentWeek = () => weekStart === getCurrentWeekStart();

  const getDateForDay = (dayIndex: number) => {
    if (!weekStart) return 0;
    const date = parseDateString(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return date.getDate();
  };

  const isToday = (dayIndex: number) => {
    if (!weekStart) return false;
    const today = new Date();
    const dayDate = parseDateString(weekStart);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    return today.toDateString() === dayDate.toDateString();
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSelectedTagIds([]);
  };

  const hasActiveFilters =
    searchQuery || categoryFilter !== "all" || selectedTagIds.length > 0;

  // Toggle tag selection
  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Filter content for the picker (exclude gift_idea from planner)
  const getFilteredContent = () => {
    if (!data?.availableContent) return [];

    const usedIds = new Set(data.plan?.items.map((i) => i.content_id) || []);

    return data.availableContent.filter((c) => {
      if (usedIds.has(c.id)) return false;
      if (c.category === "gift_idea") return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;

      // Tag filtering
      if (selectedTagIds.length > 0) {
        const contentTagIds = c.tags?.map((t) => t.id) || [];
        const hasMatchingTag = selectedTagIds.some((tagId) =>
          contentTagIds.includes(tagId)
        );
        if (!hasMatchingTag) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return c.title.toLowerCase().includes(query);
      }
      return true;
    });
  };

  // Generate grocery list from meal/drink items using AI
  const generateGroceryList = async () => {
    if (!data?.plan?.items) return;

    // Include shared items too
    const allItems = [...(data.plan.items || []), ...(data.sharedItems || [])];

    // Build recipes list for the API
    const recipes: {
      id: string;
      title: string;
      category: string;
      ingredients: string[];
    }[] = [];

    for (const item of allItems) {
      const content = item.content;
      if (!content) continue;

      let ingredients: string[] = [];

      if (content.category === "meal") {
        const mealData = content.data as MealData;
        ingredients = mealData.ingredients || [];
      } else if (content.category === "drink") {
        const drinkData = content.data as DrinkData;
        ingredients = drinkData.ingredients || [];
      }

      if (ingredients.length > 0) {
        recipes.push({
          id: content.id,
          title: content.title,
          category: content.category,
          ingredients,
        });
      }
    }

    if (recipes.length === 0) {
      setGroceryList({
        isOpen: true,
        items: [],
        tips: [],
        expandedIngredient: null,
        loading: false,
        saving: false,
        error: "No recipes with ingredients found for this week.",
      });
      return;
    }

    // Open modal and show loading state
    setGroceryList({
      isOpen: true,
      items: [],
      tips: [],
      expandedIngredient: null,
      loading: true,
      saving: false,
      error: null,
    });

    try {
      // Pass weekStart to API for database caching
      const response = await fetch("/api/planner/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipes, weekStart }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate grocery list");
      }

      const items = result.items || [];
      const tips = result.tips || [];

      setGroceryList((s) => ({
        ...s,
        items,
        tips,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error("Failed to generate grocery list:", error);
      setGroceryList((s) => ({
        ...s,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate grocery list",
      }));
    }
  };

  // Save grocery list as screenshot - creates a clean, plain text list for OCR/import
  const saveGroceryScreenshot = async () => {
    if (groceryList.items.length === 0) return;

    setGroceryList((s) => ({ ...s, saving: true }));

    try {
      // Create a temporary container with plain black text on white background
      const container = document.createElement("div");
      container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        background: white;
        padding: 32px;
        font-family: Arial, sans-serif;
        font-size: 18px;
        line-height: 1.6;
        color: black;
        width: 400px;
      `;

      // Build a simple list: just ingredient and quantity
      const listItems = groceryList.items.map((item) => {
        const quantity = item.quantity ? ` - ${item.quantity}` : "";
        return `${item.ingredient}${quantity}`;
      });

      // Create the content - simple bulleted list
      container.innerHTML = `
        <div style="margin-bottom: 16px; font-weight: bold; font-size: 20px; border-bottom: 2px solid black; padding-bottom: 8px;">
          Grocery List
        </div>
        <div style="white-space: pre-line;">
${listItems.map((item) => `• ${item}`).join("\n")}
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });

      document.body.removeChild(container);

      const link = document.createElement("a");
      link.download = `grocery-list-${weekStart}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to save screenshot:", error);
    } finally {
      setGroceryList((s) => ({ ...s, saving: false }));
    }
  };

  // Check if there are any meal/drink items for grocery list
  const hasMealOrDrinkItems = useMemo(() => {
    if (!data?.plan?.items && !data?.sharedItems) return false;
    const allItems = [...(data.plan?.items || []), ...(data.sharedItems || [])];
    return allItems.some(
      (item) =>
        item.content?.category === "meal" || item.content?.category === "drink"
    );
  }, [data?.plan?.items, data?.sharedItems]);

  // Initial loading
  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-paper'>
        <div className='animate-shimmer w-16 h-16 rounded-full' />
      </div>
    );
  }

  // Combine own items and shared items by day
  type DisplayItem = (PlanItemWithSharing | SharedPlanItem) & {
    isSharedWithMe?: boolean;
  };

  const itemsByDay: Record<number, DisplayItem[]> = {};
  for (let i = 0; i <= 6; i++) {
    const ownItems: DisplayItem[] = (
      data?.plan?.items.filter((item) => item.day_of_week === i) || []
    ).map((item) => ({ ...item, isSharedWithMe: false }));

    const sharedItems: DisplayItem[] = (
      data?.sharedItems?.filter((item) => item.day_of_week === i) || []
    ).map((item) => ({ ...item, isSharedWithMe: true }));

    itemsByDay[i] = [...ownItems, ...sharedItems];
  }

  return (
    <main className='min-h-screen pb-28 md:pb-8 bg-paper'>
      {/* Scrapbook Header */}
      <div className='pt-6 pb-4 px-4 md:px-6'>
        <div className='max-w-7xl mx-auto flex items-center justify-between'>
          <Link href='/dashboard'>
            <Button
              variant='ghost'
              size='sm'
              className='hover:bg-washi-mint/20'
            >
              ← Back
            </Button>
          </Link>
          <div className='relative'>
            <h1 className='font-handwritten text-3xl md:text-4xl text-foreground transform -rotate-1'>
              Weekly Plan
            </h1>
            <div className='absolute -bottom-1 left-0 right-0 h-2 bg-washi-blue/60 transform rotate-0.5 -z-10' />
          </div>
          {/* Grocery List Button */}
          <Button
            variant='ghost'
            size='sm'
            onClick={generateGroceryList}
            disabled={!hasMealOrDrinkItems}
            className='hover:bg-washi-mint/20'
            title={
              hasMealOrDrinkItems
                ? "Generate grocery list"
                : "Add meals to generate grocery list"
            }
          >
            🛒 <span className='hidden sm:inline ml-1'>Groceries</span>
          </Button>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-3 md:px-4'>
        {/* Week Navigation */}
        <div className='scrapbook-card p-3 md:p-4 mb-4 md:mb-6 flex items-center justify-between relative'>
          <div className='absolute -top-2 left-8 w-14 h-5 bg-washi-yellow/80 transform -rotate-1' />
          <Button
            variant='ghost'
            size='sm'
            onClick={() => navigateWeek(-1)}
            className='px-2 md:px-3'
            disabled={gridLoading}
          >
            ← <span className='hidden sm:inline ml-1'>Prev</span>
          </Button>
          <div className='text-center relative'>
            <h2 className='text-base md:text-xl font-semibold font-handwritten'>
              {formatWeekRange()}
            </h2>
            <div className='flex items-center justify-center gap-2 mt-1 flex-wrap'>
              {isCurrentWeek() && (
                <span className='sticker sticker-event text-[10px]'>
                  This Week
                </span>
              )}
              {data?.sharedItems && data.sharedItems.length > 0 && (
                <span className='sticker sticker-date_idea text-[10px]'>
                  🤝 {data.sharedItems.length} shared
                </span>
              )}
            </div>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => navigateWeek(1)}
            className='px-2 md:px-3'
            disabled={gridLoading}
          >
            <span className='hidden sm:inline mr-1'>Next</span> →
          </Button>
        </div>

        {/* Week Grid - with loading overlay */}
        <div className='relative'>
          {gridLoading && (
            <div className='absolute inset-0 bg-paper/70 z-10 flex items-center justify-center'>
              <div className='animate-shimmer w-12 h-12 rounded-full' />
            </div>
          )}
          <div className='grid grid-cols-1 md:grid-cols-7 gap-3'>
            {DAYS.map((day, dayIndex) => (
              <Card
                key={day}
                className={`glass overflow-hidden ${
                  isToday(dayIndex)
                    ? "border-primary/50 ring-2 ring-primary/20"
                    : ""
                }`}
              >
                {/* Mobile Layout */}
                <div className='md:hidden'>
                  <div className='p-3'>
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-2'>
                        <span className='text-lg font-bold text-primary'>
                          {getDateForDay(dayIndex)}
                        </span>
                        <span className='text-sm text-muted-foreground'>
                          {DAYS_FULL[dayIndex]}
                        </span>
                        {isToday(dayIndex) && (
                          <Badge variant='secondary' className='text-xs'>
                            Today
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-7 px-2 text-xs'
                        onClick={() => setAddingToDay(dayIndex)}
                      >
                        + Add
                      </Button>
                    </div>

                    {itemsByDay[dayIndex].length > 0 ? (
                      <div className='space-y-2'>
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
                                href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                                className='flex gap-3'
                              >
                                {item.content?.thumbnail_url && (
                                  <img
                                    src={item.content.thumbnail_url}
                                    alt=''
                                    className='w-20 h-20 object-cover shrink-0'
                                  />
                                )}
                                <div className='flex-1 py-2 pr-16 min-w-0'>
                                  <div className='flex items-center gap-1.5 mb-1'>
                                    <span className='text-sm'>
                                      {
                                        CATEGORY_EMOJI[
                                          item.content?.category || "other"
                                        ]
                                      }
                                    </span>
                                    <span className='text-xs text-muted-foreground capitalize'>
                                      {item.content?.category?.replace(
                                        "_",
                                        " "
                                      )}
                                    </span>
                                    {isShared && (
                                      <span className='text-[10px] bg-washi-pink/30 px-1.5 py-0.5 rounded'>
                                        from {sharedItem?.owner_name}
                                      </span>
                                    )}
                                    {ownItem?.shared_with &&
                                      ownItem.shared_with.length > 0 && (
                                        <span className='text-[10px] bg-washi-mint/30 px-1.5 py-0.5 rounded'>
                                          🤝 {ownItem.shared_with.length}
                                        </span>
                                      )}
                                  </div>
                                  <p className='font-medium text-sm line-clamp-2'>
                                    {item.content?.title}
                                  </p>
                                </div>
                              </Link>
                              <div className='absolute top-2 right-2 flex gap-1'>
                                {isShared ? (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      leaveSharedItem(item.id);
                                    }}
                                    className='bg-secondary/90 text-secondary-foreground rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-md'
                                    title='Leave'
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
                                      className='bg-washi-mint/90 text-foreground rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-md'
                                      title='Share'
                                    >
                                      🤝
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeFromDay(item.id);
                                      }}
                                      className='bg-destructive/90 text-destructive-foreground rounded-full w-7 h-7 text-sm flex items-center justify-center shadow-md'
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
                        className='w-full glass rounded-xl overflow-hidden border border-dashed border-primary/30 hover:bg-primary/5 transition-colors'
                      >
                        <div className='flex gap-3'>
                          {data.suggestions[dayIndex][0].thumbnail_url && (
                            <img
                              src={data.suggestions[dayIndex][0].thumbnail_url}
                              alt=''
                              className='w-16 h-16 object-cover shrink-0 opacity-60'
                            />
                          )}
                          <div className='flex-1 py-2 pr-3 min-w-0'>
                            <p className='text-xs text-muted-foreground mb-0.5'>
                              Suggested
                            </p>
                            <p className='text-sm line-clamp-2 text-muted-foreground'>
                              {data.suggestions[dayIndex][0].title}
                            </p>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className='text-center py-4 text-muted-foreground text-sm'>
                        No plans yet
                      </div>
                    )}
                  </div>
                </div>
                {/* Desktop Layout */}
                <div className='hidden md:block'>
                  <div className='px-3 pt-3 pb-2 border-b border-border/50'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-1.5'>
                        <span className='text-xl font-bold text-primary'>
                          {getDateForDay(dayIndex)}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {DAYS[dayIndex]}
                        </span>
                      </div>
                      {isToday(dayIndex) && (
                        <Badge
                          variant='secondary'
                          className='text-[10px] px-1.5'
                        >
                          Today
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className='p-2 space-y-2 min-h-[180px]'>
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
                            href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                            className='block'
                          >
                            {item.content?.thumbnail_url && (
                              <img
                                src={item.content.thumbnail_url}
                                alt=''
                                className='w-full h-24 object-cover'
                              />
                            )}
                            <div className='p-2'>
                              <div className='flex items-center gap-1 mb-0.5 flex-wrap'>
                                <span className='text-xs'>
                                  {
                                    CATEGORY_EMOJI[
                                      item.content?.category || "other"
                                    ]
                                  }
                                </span>
                                {isShared && (
                                  <span className='text-[8px] bg-washi-pink/30 px-1 py-0.5 rounded'>
                                    {sharedItem?.owner_name}
                                  </span>
                                )}
                                {ownItem?.shared_with &&
                                  ownItem.shared_with.length > 0 && (
                                    <span className='text-[8px] bg-washi-mint/30 px-1 py-0.5 rounded'>
                                      🤝 {ownItem.shared_with.length}
                                    </span>
                                  )}
                              </div>
                              <p className='text-xs font-medium line-clamp-2'>
                                {item.content?.title}
                              </p>
                            </div>
                          </Link>
                          <div className='absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            {isShared ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  leaveSharedItem(item.id);
                                }}
                                className='bg-secondary/90 text-secondary-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center'
                                title='Leave'
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
                                  className='bg-washi-mint/90 text-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center'
                                  title='Share'
                                >
                                  🤝
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeFromDay(item.id);
                                  }}
                                  className='bg-destructive/90 text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center'
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {itemsByDay[dayIndex].length === 0 &&
                      data?.suggestions?.[dayIndex]?.[0] && (
                        <button
                          onClick={() =>
                            addToDay(data.suggestions[dayIndex][0].id, dayIndex)
                          }
                          className='w-full glass rounded-lg overflow-hidden border border-dashed border-primary/30 hover:bg-primary/5 transition-colors'
                        >
                          {data.suggestions[dayIndex][0].thumbnail_url && (
                            <img
                              src={data.suggestions[dayIndex][0].thumbnail_url}
                              alt=''
                              className='w-full h-16 object-cover opacity-50'
                            />
                          )}
                          <div className='p-2'>
                            <p className='text-[10px] text-muted-foreground'>
                              Suggested
                            </p>
                            <p className='text-xs line-clamp-2 text-muted-foreground'>
                              {data.suggestions[dayIndex][0].title}
                            </p>
                          </div>
                        </button>
                      )}

                    <Button
                      variant='ghost'
                      size='sm'
                      className='w-full h-8 text-xs border border-dashed'
                      onClick={() => setAddingToDay(dayIndex)}
                    >
                      +
                    </Button>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {data?.availableContent.length === 0 && (
          <div className='glass rounded-2xl p-6 md:p-8 mt-6 text-center'>
            <p className='text-lg md:text-xl mb-2'>No saved content yet!</p>
            <p className='text-sm text-muted-foreground mb-4'>
              Text TikTok or Instagram links to save meals, events, and date
              ideas.
            </p>
            <Link href='/dashboard'>
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {addingToDay !== null && (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4'>
          <div className='glass w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col'>
            <div className='p-4 border-b border-border flex items-center justify-between shrink-0'>
              <h3 className='font-semibold'>Add to {DAYS_FULL[addingToDay]}</h3>
              <button
                onClick={() => setAddingToDay(null)}
                className='text-muted-foreground hover:text-foreground p-1'
              >
                ✕
              </button>
            </div>

            {/* Scrollable content area - includes filters and list */}
            <div className='flex-1 overflow-y-auto overscroll-contain'>
              {/* Search & Filters */}
              <div className='p-4 border-b border-border space-y-3 sticky top-0 glass z-10'>
                <div className='flex gap-2'>
                  <Input
                    type='text'
                    placeholder='Search...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='flex-1'
                    autoFocus
                  />
                  {hasActiveFilters && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={clearAllFilters}
                      className='shrink-0 text-xs text-destructive hover:text-destructive'
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Category filters */}
                <div className='flex gap-2 overflow-x-auto pb-1'>
                  <Button
                    variant={categoryFilter === "all" ? "default" : "ghost"}
                    size='sm'
                    onClick={() => setCategoryFilter("all")}
                    className='shrink-0'
                  >
                    All
                  </Button>
                  <Button
                    variant={categoryFilter === "meal" ? "default" : "ghost"}
                    size='sm'
                    onClick={() => setCategoryFilter("meal")}
                    className='shrink-0'
                  >
                    🍽️ Meals
                  </Button>
                  <Button
                    variant={categoryFilter === "drink" ? "default" : "ghost"}
                    size='sm'
                    onClick={() => setCategoryFilter("drink")}
                    className='shrink-0'
                  >
                    🍹 Drinks
                  </Button>
                  <Button
                    variant={categoryFilter === "event" ? "default" : "ghost"}
                    size='sm'
                    onClick={() => setCategoryFilter("event")}
                    className='shrink-0'
                  >
                    🎉 Events
                  </Button>
                  <Button
                    variant={
                      categoryFilter === "date_idea" ? "default" : "ghost"
                    }
                    size='sm'
                    onClick={() => setCategoryFilter("date_idea")}
                    className='shrink-0'
                  >
                    💕 Dates
                  </Button>
                </div>
              </div>

              {/* Tag filters - collapsible, scrolls with content */}
              {data?.allTags && data.allTags.length > 0 && (
                <div className='px-4 py-2 border-b border-border'>
                  <TagFilter
                    tags={data.allTags}
                    selectedTags={selectedTagIds}
                    onToggle={toggleTagSelection}
                    onClear={() => setSelectedTagIds([])}
                  />
                </div>
              )}

              {/* Content List */}
              <div className='p-4 space-y-2'>
                {getFilteredContent().map((content) => (
                  <button
                    key={content.id}
                    onClick={() => addToDay(content.id, addingToDay)}
                    className='w-full glass rounded-xl p-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3'
                  >
                    {content.thumbnail_url && (
                      <img
                        src={content.thumbnail_url}
                        alt=''
                        className='w-16 h-16 object-cover rounded-lg shrink-0'
                      />
                    )}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span>{CATEGORY_EMOJI[content.category]}</span>
                        <span className='text-sm font-medium line-clamp-1'>
                          {content.title}
                        </span>
                      </div>
                      <p className='text-xs text-muted-foreground capitalize'>
                        {content.category.replace("_", " ")}
                      </p>
                      {content.tags && content.tags.length > 0 && (
                        <div className='flex flex-wrap gap-1 mt-1'>
                          {content.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className='text-[10px] px-1.5 py-0.5 bg-secondary rounded'
                            >
                              {tag.name}
                            </span>
                          ))}
                          {content.tags.length > 3 && (
                            <span className='text-[10px] text-muted-foreground'>
                              +{content.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                {getFilteredContent().length === 0 && (
                  <div className='text-center py-8 text-muted-foreground'>
                    <p>No items found</p>
                    {hasActiveFilters && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={clearAllFilters}
                        className='mt-2'
                      >
                        Clear all filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grocery List Modal */}
      {groceryList.isOpen && (
        <div className='fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4'>
          <div className='glass rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col'>
            <div className='flex items-center justify-between p-4 border-b border-border/50'>
              <div>
                <h2 className='text-lg font-semibold'>🛒 Grocery List</h2>
                <p className='text-xs text-muted-foreground'>
                  {formatWeekRange()}
                </p>
              </div>
              <div className='flex gap-2'>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={saveGroceryScreenshot}
                  disabled={
                    groceryList.saving ||
                    groceryList.loading ||
                    groceryList.items.length === 0
                  }
                >
                  {groceryList.saving ? "Saving..." : "📷 Save"}
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setGroceryList((s) => ({ ...s, isOpen: false }))
                  }
                >
                  ×
                </Button>
              </div>
            </div>

            <div className='flex-1 overflow-y-auto'>
              {/* Loading State */}
              {groceryList.loading && (
                <div className='flex flex-col items-center justify-center py-16'>
                  <div className='animate-shimmer w-12 h-12 rounded-full mb-4' />
                  <p className='text-muted-foreground'>
                    Generating your grocery list...
                  </p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    AI is organizing your ingredients
                  </p>
                </div>
              )}

              {/* Error State */}
              {groceryList.error && !groceryList.loading && (
                <div className='flex flex-col items-center justify-center py-16 px-4'>
                  <div className='text-4xl mb-4'>😕</div>
                  <p className='text-muted-foreground text-center'>
                    {groceryList.error}
                  </p>
                  <Button
                    variant='secondary'
                    size='sm'
                    className='mt-4'
                    onClick={() =>
                      setGroceryList((s) => ({ ...s, isOpen: false }))
                    }
                  >
                    Close
                  </Button>
                </div>
              )}

              {/* Grocery List Content */}
              {!groceryList.loading && !groceryList.error && (
                <div ref={groceryListRef} className='p-4 bg-white'>
                  {groceryList.items.length > 0 ? (
                    <>
                      {/* Group items by category */}
                      {(() => {
                        const categories = [
                          ...new Set(groceryList.items.map((i) => i.category)),
                        ];
                        return categories.map((category) => (
                          <div key={category} className='mb-4'>
                            <h4 className='font-medium text-sm text-primary mb-2 border-b border-primary/20 pb-1'>
                              {category}
                            </h4>
                            <ul className='space-y-2'>
                              {groceryList.items
                                .filter((item) => item.category === category)
                                .map((item, index) => (
                                  <li key={index}>
                                    <button
                                      onClick={() =>
                                        setGroceryList((s) => ({
                                          ...s,
                                          expandedIngredient:
                                            s.expandedIngredient ===
                                            item.ingredient
                                              ? null
                                              : item.ingredient,
                                        }))
                                      }
                                      className='w-full text-left flex items-start gap-2 hover:bg-secondary/20 rounded px-1 -mx-1 py-1'
                                    >
                                      <span className='text-primary mt-0.5'>
                                        •
                                      </span>
                                      <div className='flex-1'>
                                        <div className='flex items-baseline gap-2'>
                                          <span className='font-medium'>
                                            {item.ingredient}
                                          </span>
                                          {item.quantity && (
                                            <span className='text-sm text-muted-foreground'>
                                              ({item.quantity})
                                            </span>
                                          )}
                                        </div>
                                        {item.notes && (
                                          <p className='text-xs text-muted-foreground italic mt-0.5'>
                                            💡 {item.notes}
                                          </p>
                                        )}
                                        <p className='text-xs text-muted-foreground mt-0.5'>
                                          For:{" "}
                                          {item.sources
                                            .map((s) => s.title)
                                            .join(", ")}
                                        </p>
                                      </div>
                                      <span className='text-xs text-muted-foreground'>
                                        {groceryList.expandedIngredient ===
                                        item.ingredient
                                          ? "▼"
                                          : "▶"}
                                      </span>
                                    </button>

                                    {groceryList.expandedIngredient ===
                                      item.ingredient && (
                                      <div className='ml-5 mt-1 mb-2 space-y-1 bg-secondary/10 rounded p-2'>
                                        <p className='text-xs font-medium mb-1'>
                                          Used in:
                                        </p>
                                        {item.sources.map((source, sIndex) => (
                                          <Link
                                            key={sIndex}
                                            href={`/dashboard/${source.id}?from=planner&week=${weekStart}`}
                                            className='block text-xs text-primary hover:underline'
                                            onClick={() =>
                                              setGroceryList((s) => ({
                                                ...s,
                                                isOpen: false,
                                              }))
                                            }
                                          >
                                            → {source.title}
                                          </Link>
                                        ))}
                                      </div>
                                    )}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ));
                      })()}

                      {/* Tips Section */}
                      {groceryList.tips.length > 0 && (
                        <div className='mt-6 pt-4 border-t border-border/30'>
                          <h4 className='font-medium text-sm mb-2'>
                            💡 Shopping Tips
                          </h4>
                          <ul className='space-y-1'>
                            {groceryList.tips.map((tip, index) => (
                              <li
                                key={index}
                                className='text-xs text-muted-foreground'
                              >
                                • {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className='text-center py-8 text-muted-foreground'>
                      <p>No ingredients found</p>
                      <p className='text-xs mt-1'>
                        Add meals or drinks with ingredients to generate a list
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Share Modal */}
      {itemShare.isOpen && (
        <div className='fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4'>
          <div className='glass rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col'>
            <div className='flex items-center justify-between p-4 border-b border-border/50'>
              <div>
                <h2 className='text-lg font-semibold'>Share Item</h2>
                <p className='text-xs text-muted-foreground line-clamp-1'>
                  {itemShare.itemTitle}
                </p>
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setItemShare((s) => ({ ...s, isOpen: false }))}
              >
                ×
              </Button>
            </div>

            <div className='flex-1 overflow-y-auto p-4 space-y-2'>
              {!itemShare.showAddFriend ? (
                <>
                  <p className='text-sm text-muted-foreground mb-3'>
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
                            <div className='flex-1'>
                              <p className='font-medium text-sm'>
                                {friend.name}
                              </p>
                              <p className='text-xs text-muted-foreground'>
                                {isSelected ? "Selected" : "Tap to select"}
                              </p>
                            </div>
                            {isSelected && (
                              <span className='text-primary'>✓</span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <div className='text-center py-6'>
                      <p className='text-muted-foreground text-sm mb-2'>
                        No friends with linked accounts yet.
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        Friends need to sign up for Planning Friend to receive
                        shared items.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: true }))
                    }
                    className='w-full p-3 rounded-xl text-left flex items-center gap-3 bg-secondary/20 hover:bg-secondary/40 transition-colors border-2 border-dashed border-border'
                  >
                    <div className='w-10 h-10 rounded-full bg-washi-yellow/30 flex items-center justify-center text-lg'>
                      +
                    </div>
                    <div className='flex-1'>
                      <p className='font-medium text-sm'>Add a Friend</p>
                      <p className='text-xs text-muted-foreground'>
                        Add someone new to share with
                      </p>
                    </div>
                  </button>
                </>
              ) : (
                <div className='space-y-4'>
                  <button
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: false }))
                    }
                    className='text-sm text-muted-foreground hover:text-foreground'
                  >
                    ← Back to friends
                  </button>

                  <div className='space-y-3'>
                    <div>
                      <label className='text-sm font-medium mb-1 block'>
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
                      <label className='text-sm font-medium mb-1 block'>
                        Phone Number{" "}
                        <span className='text-muted-foreground'>
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
                        placeholder='(555) 123-4567'
                        type='tel'
                      />
                      <p className='text-xs text-muted-foreground mt-1'>
                        If they have Planning Friend, they&apos;ll be linked
                        automatically.
                      </p>
                    </div>

                    <Button
                      onClick={addNewFriend}
                      disabled={
                        itemShare.loading || !itemShare.newFriendName.trim()
                      }
                      className='w-full'
                    >
                      {itemShare.loading ? "Adding..." : "Add Friend"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {!itemShare.showAddFriend && (
              <div className='p-4 border-t border-border/50 space-y-3'>
                {itemShare.error && (
                  <p className='text-sm text-destructive text-center'>
                    {itemShare.error}
                  </p>
                )}
                {itemShare.success && (
                  <p className='text-sm text-primary text-center'>
                    {itemShare.success}
                  </p>
                )}
                <Button
                  onClick={shareItem}
                  disabled={
                    itemShare.loading ||
                    itemShare.selectedFriendIds.length === 0
                  }
                  className='w-full'
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

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen flex items-center justify-center bg-paper'>
          <div className='animate-shimmer w-16 h-16 rounded-full' />
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
