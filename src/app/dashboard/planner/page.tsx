"use client";

import { TagFilter } from "@/components/tag-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlanner } from "@/hooks/usePlanner";
import type {
  ContentCategory,
  DrinkData,
  MealData,
  PlanItem,
  SharedPlanItem,
} from "@/lib/supabase";
import {
  formatDateString,
  getOrderedDays,
  getWeekStartDay,
  getWeekStartForDate,
  parseDateString,
} from "@/lib/utils";
import html2canvas from "html2canvas";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  FileText,
  Gift,
  Hand,
  Heart,
  Loader2,
  Pin,
  Plus,
  ShoppingCart,
  Star,
  User,
  Users,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "../useSession";

// Category icon mapping
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  meal: Utensils,
  drink: Coffee,
  event: Calendar,
  date_idea: Heart,
  gift_idea: Gift,
  other: Pin,
};

// Extended plan item with sharing info from API
interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  shared_with?: { userId: string; name: string }[];
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
  const [weekStart, setWeekStart] = useState<string>("");
  const [addingToDay, setAddingToDay] = useState<number | null>(null);
  const [quickNoteInput, setQuickNoteInput] = useState("");
  const [addingQuickNote, setAddingQuickNote] = useState(false);

  // Week start day preference (0=Sunday, 1=Monday, etc.)
  const weekStartDay = useMemo(() => getWeekStartDay(), []);

  // Dynamic day name arrays based on user's week start preference
  const { days: DAYS, daysFull: DAYS_FULL } = useMemo(
    () => getOrderedDays(weekStartDay),
    [weekStartDay]
  );

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

  const searchParams = useSearchParams();

  // Session management with SWR
  const { user, isLoading: sessionLoading } = useSession();

  // Planner data with SWR
  const {
    data,
    isLoading: plannerLoading,
    isValidating: gridLoading,
    mutate: mutatePlanner,
  } = usePlanner(weekStart || null, { enabled: !!user && !!weekStart });

  // Combined loading state
  const loading = sessionLoading || (!!weekStart && plannerLoading && !data);

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

  const getCurrentWeekStart = useCallback(() => {
    return getWeekStartForDate(new Date(), weekStartDay);
  }, [weekStartDay]);

  // Initialize weekStart from URL or current week
  useEffect(() => {
    const urlWeek = searchParams.get("week");
    const week = urlWeek || getCurrentWeekStart();
    setWeekStart(week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateWeek = (direction: number) => {
    const current = parseDateString(weekStart);
    current.setDate(current.getDate() + direction * 7);
    const newWeek = formatDateString(current);

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("week", newWeek);
    window.history.pushState({}, "", newUrl.toString());

    setWeekStart(newWeek);
  };

  const addToDay = async (contentId: string, dayOfWeek: number) => {
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, contentId, dayOfWeek }),
      });

      if (res.ok) {
        mutatePlanner();
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
    setAddingToDay(null);
  };

  const addQuickNote = async (dayOfWeek: number) => {
    if (!quickNoteInput.trim()) return;

    setAddingQuickNote(true);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          noteTitle: quickNoteInput.trim(),
          dayOfWeek,
        }),
      });

      if (res.ok) {
        setQuickNoteInput("");
        mutatePlanner();
        setAddingToDay(null);
      }
    } catch (error) {
      console.error("Failed to add quick note:", error);
    } finally {
      setAddingQuickNote(false);
    }
  };

  const removeFromDay = async (itemId: string) => {
    try {
      const res = await fetch(`/api/planner/item?id=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        mutatePlanner();
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

    const itemTitle = item.note_title || item.content?.title || "Item";

    setItemShare({
      isOpen: true,
      itemId: item.id,
      itemTitle,
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

      mutatePlanner();

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
        mutatePlanner();
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

      mutatePlanner();

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

  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSelectedTagIds([]);
  };

  const hasActiveFilters =
    searchQuery || categoryFilter !== "all" || selectedTagIds.length > 0;

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getFilteredContent = () => {
    if (!data?.availableContent) return [];

    const usedIds = new Set(data.plan?.items.map((i) => i.content_id) || []);

    return data.availableContent.filter((c) => {
      if (usedIds.has(c.id)) return false;
      if (c.category === "gift_idea") return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;

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

  // Generate grocery list
  const generateGroceryList = async () => {
    if (!data?.plan?.items) return;

    const allItems = [...(data.plan.items || []), ...(data.sharedItems || [])];

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

  const saveGroceryScreenshot = async () => {
    if (groceryList.items.length === 0) return;

    setGroceryList((s) => ({ ...s, saving: true }));

    try {
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

      const listItems = groceryList.items.map((item) => {
        const quantity = item.quantity ? ` - ${item.quantity}` : "";
        return `${item.ingredient}${quantity}`;
      });

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

  const hasMealOrDrinkItems = useMemo(() => {
    if (!data?.plan?.items && !data?.sharedItems) return false;
    const allItems = [...(data.plan?.items || []), ...(data.sharedItems || [])];
    return allItems.some(
      (item) =>
        item.content?.category === "meal" || item.content?.category === "drink"
    );
  }, [data?.plan?.items, data?.sharedItems]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your planner...</p>
        </div>
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
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="btn-ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="heading-2 text-xl md:text-2xl">
            Weekly Plan
          </h1>
          <Button
            variant="ghost"
            onClick={generateGroceryList}
            disabled={!hasMealOrDrinkItems}
            className="btn-ghost"
            title={
              hasMealOrDrinkItems
                ? "Generate grocery list"
                : "Add meals to generate grocery list"
            }
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Groceries</span>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Week Navigation */}
        <div className="card-elevated p-4 mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigateWeek(-1)}
            className="btn-ghost"
            disabled={gridLoading}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Prev</span>
          </Button>
          <div className="text-center">
            <h2 className="text-lg md:text-xl font-semibold">
              {formatWeekRange()}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              {isCurrentWeek() && (
                <Badge className="bg-[var(--accent-light)] text-[var(--accent-foreground)]">
                  This Week
                </Badge>
              )}
              {data?.sharedItems && data.sharedItems.length > 0 && (
                <Badge variant="date">
                  <Users className="w-3 h-3" />
                  {data.sharedItems.length} shared
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigateWeek(1)}
            className="btn-ghost"
            disabled={gridLoading}
          >
            <span className="hidden sm:inline mr-2">Next</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Week Grid */}
        <div className="relative">
          {gridLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
              <div className="loading-spinner" />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {DAYS.map((day, dayIndex) => (
              <Card
                key={day}
                className={`card-elevated overflow-hidden ${
                  isToday(dayIndex) ? "ring-2 ring-[var(--primary)]" : ""
                }`}
              >
                {/* Mobile Layout */}
                <div className="md:hidden">
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-mono text-primary">
                          {String(getDateForDay(dayIndex)).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-bold uppercase">
                          {DAYS_FULL[dayIndex]}
                        </span>
                        {isToday(dayIndex) && (
                          <Badge className="brutal-badge bg-primary text-primary-foreground text-[10px]">
                            Today
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs border-2 border-border"
                        onClick={() => setAddingToDay(dayIndex)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>

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
                          const isQuickNote =
                            !item.content_id && item.note_title;

                          // Quick note display (mobile)
                          if (isQuickNote) {
                            return (
                              <div
                                key={item.id}
                                className={`group relative brutal-card-static overflow-hidden p-3 ${
                                  isShared
                                    ? "border-l-4 border-l-pink-400 bg-pink-50"
                                    : "bg-accent"
                                }`}
                              >
                                <div className="flex items-center gap-2 pr-16">
                                  <FileText className="w-4 h-4" />
                                  <p className="font-medium text-sm flex-1">
                                    {item.note_title}
                                  </p>
                                  {isShared && (
                                    <span className="text-[10px] bg-pink-100 text-pink-800 px-1.5 py-0.5 border border-pink-300 font-medium">
                                      from {sharedItem?.owner_name}
                                    </span>
                                  )}
                                  {ownItem?.shared_with &&
                                    ownItem.shared_with.length > 0 && (
                                      <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 border border-green-300 font-medium">
                                        <Users className="w-3 h-3 inline mr-0.5" />
                                        {ownItem.shared_with.length}
                                      </span>
                                    )}
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1">
                                  {isShared ? (
                                    <button
                                      onClick={() => leaveSharedItem(item.id)}
                                      className="bg-card border-2 border-border w-7 h-7 text-xs flex items-center justify-center shadow-[2px_2px_0_#0a0a0a]"
                                      title="Leave"
                                    >
                                      <Hand className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => openShareModal(ownItem!)}
                                        className="bg-card border-2 border-border w-7 h-7 text-xs flex items-center justify-center shadow-[2px_2px_0_#0a0a0a]"
                                        title="Share"
                                      >
                                        <Users className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => removeFromDay(item.id)}
                                        className="bg-destructive text-destructive-foreground border-2 border-border w-7 h-7 text-xs flex items-center justify-center shadow-[2px_2px_0_#0a0a0a]"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          const Icon =
                            CATEGORY_ICONS[item.content?.category || "other"] ||
                            Pin;

                          // Content item display (mobile)
                          return (
                            <div
                              key={item.id}
                              className={`group relative brutal-card-static overflow-hidden ${
                                isShared
                                  ? "border-l-4 border-l-pink-400 bg-pink-50"
                                  : ""
                              }`}
                            >
                              <Link
                                href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                                className="flex gap-3"
                              >
                                {item.content?.thumbnail_url && (
                                  <img
                                    src={item.content.thumbnail_url}
                                    alt=""
                                    className="w-20 h-20 object-cover shrink-0 border-r-[3px] border-border"
                                  />
                                )}
                                <div className="flex-1 py-2 pr-16 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Icon className="w-4 h-4" />
                                    <span className="text-xs font-mono uppercase text-muted-foreground">
                                      {item.content?.category?.replace(
                                        "_",
                                        " "
                                      )}
                                    </span>
                                    {isShared && (
                                      <span className="text-[10px] bg-pink-100 text-pink-800 px-1.5 py-0.5 border border-pink-300 font-medium">
                                        from {sharedItem?.owner_name}
                                      </span>
                                    )}
                                    {ownItem?.shared_with &&
                                      ownItem.shared_with.length > 0 && (
                                        <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 border border-green-300 font-medium">
                                          <Users className="w-3 h-3 inline mr-0.5" />
                                          {ownItem.shared_with.length}
                                        </span>
                                      )}
                                  </div>
                                  <p className="font-medium text-sm line-clamp-2">
                                    {item.content?.title}
                                  </p>
                                </div>
                              </Link>
                              <div className="absolute top-2 right-2 flex gap-1">
                                {isShared ? (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      leaveSharedItem(item.id);
                                    }}
                                    className="bg-card border-2 border-border w-7 h-7 text-xs flex items-center justify-center shadow-[2px_2px_0_#0a0a0a]"
                                    title="Leave"
                                  >
                                    <Hand className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openShareModal(ownItem!);
                                      }}
                                      className="bg-card border-2 border-border w-7 h-7 text-xs flex items-center justify-center shadow-[2px_2px_0_#0a0a0a]"
                                      title="Share"
                                    >
                                      <Users className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeFromDay(item.id);
                                      }}
                                      className="bg-destructive text-destructive-foreground border-2 border-border w-7 h-7 text-xs flex items-center justify-center shadow-[2px_2px_0_#0a0a0a]"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm font-mono">
                        No plans yet
                      </div>
                    )}
                  </div>
                </div>
                {/* Desktop Layout */}
                <div className="hidden md:block">
                  <div className="px-3 pt-3 pb-2 border-b-[3px] border-border bg-accent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold font-mono text-primary">
                          {String(getDateForDay(dayIndex)).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-bold uppercase">
                          {DAYS[dayIndex]}
                        </span>
                      </div>
                      {isToday(dayIndex) && (
                        <Badge className="brutal-badge bg-primary text-primary-foreground text-[10px]">
                          Today
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-2 space-y-2 min-h-[180px]">
                    {itemsByDay[dayIndex].map((item) => {
                      const isShared = item.isSharedWithMe;
                      const sharedItem = isShared
                        ? (item as SharedPlanItem)
                        : null;
                      const ownItem = !isShared
                        ? (item as PlanItemWithSharing)
                        : null;
                      const isQuickNote = !item.content_id && item.note_title;

                      // Quick note (desktop)
                      if (isQuickNote) {
                        return (
                          <div
                            key={item.id}
                            className={`group relative brutal-card-static overflow-hidden p-2 ${
                              isShared
                                ? "border-l-4 border-l-pink-400 bg-pink-50"
                                : "bg-accent"
                            }`}
                          >
                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                              <FileText className="w-3 h-3" />
                              {isShared && (
                                <span className="text-[8px] bg-pink-100 text-pink-800 px-1 py-0.5 border border-pink-300 font-medium">
                                  {sharedItem?.owner_name}
                                </span>
                              )}
                              {ownItem?.shared_with &&
                                ownItem.shared_with.length > 0 && (
                                  <span className="text-[8px] bg-green-100 text-green-800 px-1 py-0.5 border border-green-300 font-medium">
                                    <Users className="w-2 h-2 inline" />{" "}
                                    {ownItem.shared_with.length}
                                  </span>
                                )}
                            </div>
                            <p className="text-xs font-medium line-clamp-2">
                              {item.note_title}
                            </p>
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isShared ? (
                                <button
                                  onClick={() => leaveSharedItem(item.id)}
                                  className="bg-card border border-border w-5 h-5 text-[10px] flex items-center justify-center"
                                  title="Leave"
                                >
                                  <Hand className="w-3 h-3" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => openShareModal(ownItem!)}
                                    className="bg-card border border-border w-5 h-5 text-[10px] flex items-center justify-center"
                                    title="Share"
                                  >
                                    <Users className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeFromDay(item.id)}
                                    className="bg-destructive text-white border border-border w-5 h-5 text-[10px] flex items-center justify-center"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const Icon =
                        CATEGORY_ICONS[item.content?.category || "other"] ||
                        Pin;

                      // Content item (desktop)
                      return (
                        <div
                          key={item.id}
                          className={`group relative brutal-card-static overflow-hidden ${
                            isShared
                              ? "border-l-4 border-l-pink-400 bg-pink-50"
                              : ""
                          }`}
                        >
                          <Link
                            href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                            className="block"
                          >
                            {item.content?.thumbnail_url && (
                              <img
                                src={item.content.thumbnail_url}
                                alt=""
                                className="w-full h-24 object-cover border-b-[3px] border-border"
                              />
                            )}
                            <div className="p-2">
                              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                <Icon className="w-3 h-3" />
                                {isShared && (
                                  <span className="text-[8px] bg-pink-100 text-pink-800 px-1 py-0.5 border border-pink-300 font-medium">
                                    {sharedItem?.owner_name}
                                  </span>
                                )}
                                {ownItem?.shared_with &&
                                  ownItem.shared_with.length > 0 && (
                                    <span className="text-[8px] bg-green-100 text-green-800 px-1 py-0.5 border border-green-300 font-medium">
                                      <Users className="w-2 h-2 inline" />{" "}
                                      {ownItem.shared_with.length}
                                    </span>
                                  )}
                              </div>
                              <p className="text-xs font-medium line-clamp-2">
                                {item.content?.title}
                              </p>
                            </div>
                          </Link>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isShared ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  leaveSharedItem(item.id);
                                }}
                                className="bg-card border border-border w-5 h-5 text-[10px] flex items-center justify-center"
                                title="Leave"
                              >
                                <Hand className="w-3 h-3" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openShareModal(ownItem!);
                                  }}
                                  className="bg-card border border-border w-5 h-5 text-[10px] flex items-center justify-center"
                                  title="Share"
                                >
                                  <Users className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeFromDay(item.id);
                                  }}
                                  className="bg-destructive text-white border border-border w-5 h-5 text-[10px] flex items-center justify-center"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs border-2 border-dashed border-border hover:bg-accent"
                      onClick={() => setAddingToDay(dayIndex)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {data?.availableContent.length === 0 && (
          <div className="card-elevated p-8 mt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-2">
              No saved content yet
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Text TikTok or Instagram links to save meals, events, and date
              ideas.
            </p>
            <Link href="/dashboard">
              <Button className="btn-primary">Go to Dashboard</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {addingToDay !== null && (
        <div className="fixed inset-0 modal-backdrop z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-[var(--card)] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] md:rounded-t-2xl">
              <h3 className="font-semibold text-white">
                Add to {DAYS_FULL[addingToDay]}
              </h3>
              <button
                onClick={() => setAddingToDay(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Quick Note Input */}
              <div className="p-4 border-b-[3px] border-border bg-accent/50">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Quick note
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addQuickNote(addingToDay);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    type="text"
                    placeholder='e.g., "Salmon", "Date night"'
                    value={quickNoteInput}
                    onChange={(e) => setQuickNoteInput(e.target.value)}
                    className="brutal-input flex-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    className="brutal-btn"
                    disabled={!quickNoteInput.trim() || addingQuickNote}
                  >
                    {addingQuickNote ? "..." : "Add"}
                  </Button>
                </form>
              </div>

              <div className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground text-center bg-secondary border-b-[3px] border-border">
                Or pick from saved items
              </div>

              {/* Search & Filters */}
              <div className="p-4 border-b-[3px] border-border space-y-3 sticky top-0 bg-card z-10">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search saved items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="brutal-input flex-1"
                  />
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="shrink-0 text-xs text-destructive hover:text-destructive border-2 border-destructive"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  {[
                    { id: "all", label: "All", icon: null },
                    { id: "meal", label: "Meals", icon: Utensils },
                    { id: "drink", label: "Drinks", icon: Coffee },
                    { id: "event", label: "Events", icon: Calendar },
                    { id: "date_idea", label: "Dates", icon: Heart },
                  ].map((cat) => (
                    <Button
                      key={cat.id}
                      variant={categoryFilter === cat.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() =>
                        setCategoryFilter(cat.id as ContentCategory | "all")
                      }
                      className={`shrink-0 ${
                        categoryFilter === cat.id
                          ? "brutal-btn"
                          : "border-2 border-border"
                      }`}
                    >
                      {cat.icon && <cat.icon className="w-3 h-3 mr-1" />}
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tag filters */}
              {data?.allTags && data.allTags.length > 0 && (
                <div className="px-4 py-2 border-b-[3px] border-border">
                  <TagFilter
                    tags={data.allTags}
                    selectedTags={selectedTagIds}
                    onToggle={toggleTagSelection}
                    onClear={() => setSelectedTagIds([])}
                  />
                </div>
              )}

              {/* Content List */}
              <div className="p-4 space-y-2">
                {getFilteredContent().map((content) => {
                  const Icon = CATEGORY_ICONS[content.category] || Pin;
                  return (
                    <button
                      key={content.id}
                      onClick={() => addToDay(content.id, addingToDay)}
                      className="w-full brutal-card p-3 text-left flex items-center gap-3"
                    >
                      {content.thumbnail_url && (
                        <img
                          src={content.thumbnail_url}
                          alt=""
                          className="w-16 h-16 object-cover shrink-0 border-2 border-border"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="text-sm font-medium line-clamp-1">
                            {content.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase font-mono">
                          {content.category.replace("_", " ")}
                        </p>
                        {content.tags && content.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {content.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="text-[10px] px-1.5 py-0.5 bg-accent border border-border"
                              >
                                {tag.name}
                              </span>
                            ))}
                            {content.tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                +{content.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {getFilteredContent().length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="font-mono uppercase">No items found</p>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="mt-2 border-2 border-border"
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
        <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--secondary)] to-[var(--secondary-dark)] rounded-t-2xl">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Grocery List
                </h2>
                <p className="text-xs text-white/80">
                  {formatWeekRange()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveGroceryScreenshot}
                  disabled={
                    groceryList.saving ||
                    groceryList.loading ||
                    groceryList.items.length === 0
                  }
                  className="text-white hover:bg-white/10"
                >
                  <Camera className="w-4 h-4 mr-1" />
                  {groceryList.saving ? "..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setGroceryList((s) => ({ ...s, isOpen: false }))
                  }
                  className="text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {groceryList.loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-12 h-12 animate-spin mb-4" />
                  <p className="text-muted-foreground font-mono uppercase">
                    Generating list...
                  </p>
                </div>
              )}

              {groceryList.error && !groceryList.loading && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <X className="w-12 h-12 mb-4 text-destructive" />
                  <p className="text-muted-foreground text-center">
                    {groceryList.error}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4 border-2 border-border"
                    onClick={() =>
                      setGroceryList((s) => ({ ...s, isOpen: false }))
                    }
                  >
                    Close
                  </Button>
                </div>
              )}

              {!groceryList.loading && !groceryList.error && (
                <div ref={groceryListRef} className="p-4 bg-white">
                  {groceryList.items.length > 0 ? (
                    <>
                      {(() => {
                        const categories = [
                          ...new Set(groceryList.items.map((i) => i.category)),
                        ];
                        return categories.map((category) => (
                          <div key={category} className="mb-4">
                            <h4 className="font-bold text-sm uppercase font-mono text-primary mb-2 border-b-2 border-primary pb-1">
                              {category}
                            </h4>
                            <ul className="space-y-2">
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
                                      className="w-full text-left flex items-start gap-2 hover:bg-secondary p-1 -mx-1"
                                    >
                                      <span className="text-primary mt-0.5">
                                        •
                                      </span>
                                      <div className="flex-1">
                                        <div className="flex items-baseline gap-2">
                                          <span className="font-medium">
                                            {item.ingredient}
                                          </span>
                                          {item.quantity && (
                                            <span className="text-sm text-muted-foreground font-mono">
                                              ({item.quantity})
                                            </span>
                                          )}
                                        </div>
                                        {item.notes && (
                                          <p className="text-xs text-muted-foreground italic mt-0.5">
                                            Note: {item.notes}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                          For:{" "}
                                          {item.sources
                                            .map((s) => s.title)
                                            .join(", ")}
                                        </p>
                                      </div>
                                      {groceryList.expandedIngredient ===
                                      item.ingredient ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </button>

                                    {groceryList.expandedIngredient ===
                                      item.ingredient && (
                                      <div className="ml-5 mt-1 mb-2 space-y-1 bg-secondary p-2 border-2 border-border">
                                        <p className="text-xs font-bold font-mono uppercase mb-1">
                                          Used in:
                                        </p>
                                        {item.sources.map((source, sIndex) => (
                                          <Link
                                            key={sIndex}
                                            href={`/dashboard/${source.id}?from=planner&week=${weekStart}`}
                                            className="block text-xs text-primary hover:underline"
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

                      {groceryList.tips.length > 0 && (
                        <div className="mt-6 pt-4 border-t-[3px] border-border">
                          <h4 className="font-bold text-sm uppercase font-mono mb-2">
                            Shopping Tips
                          </h4>
                          <ul className="space-y-1">
                            {groceryList.tips.map((tip, index) => (
                              <li
                                key={index}
                                className="text-xs text-muted-foreground"
                              >
                                • {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-mono uppercase">
                        No ingredients found
                      </p>
                      <p className="text-xs mt-1">
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
        <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] rounded-t-2xl">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Share Item
                </h2>
                <p className="text-xs text-white/80 line-clamp-1">
                  {itemShare.itemTitle}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItemShare((s) => ({ ...s, isOpen: false }))}
                className="text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!itemShare.showAddFriend ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select friends to share this item with.
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
                            className={`w-full p-3 text-left flex items-center gap-3 transition-colors brutal-card ${
                              isSelected
                                ? "bg-primary/10 border-primary"
                                : "bg-card"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 flex items-center justify-center border-2 border-border ${
                                isSelected ? "bg-primary/20" : "bg-accent"
                              }`}
                            >
                              {friend.isFavorite ? (
                                <Star className="w-5 h-5" />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {friend.name}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {isSelected ? "Selected" : "Tap to select"}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-primary" />
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

                  <button
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: true }))
                    }
                    className="w-full p-3 text-left flex items-center gap-3 brutal-card border-dashed"
                  >
                    <div className="w-10 h-10 flex items-center justify-center border-2 border-dashed border-border bg-accent">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Add a Friend</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Add someone new to share with
                      </p>
                    </div>
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: false }))
                    }
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to friends
                  </button>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-bold uppercase mb-1 block font-mono">
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
                        className="brutal-input"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold uppercase mb-1 block font-mono">
                        Phone{" "}
                        <span className="text-muted-foreground font-normal">
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
                        className="brutal-input"
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
                      className="brutal-btn w-full"
                    >
                      {itemShare.loading ? "Adding..." : "Add Friend"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {!itemShare.showAddFriend && (
              <div className="p-4 border-t-[3px] border-border space-y-3">
                {itemShare.error && (
                  <p className="text-sm text-destructive text-center font-mono">
                    {itemShare.error}
                  </p>
                )}
                {itemShare.success && (
                  <p className="text-sm text-primary text-center font-mono">
                    {itemShare.success}
                  </p>
                )}
                <Button
                  onClick={shareItem}
                  disabled={
                    itemShare.loading ||
                    itemShare.selectedFriendIds.length === 0
                  }
                  className="brutal-btn w-full"
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
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Loading planner...</p>
          </div>
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
