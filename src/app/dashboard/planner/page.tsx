"use client";

import { TagFilter } from "@/components/tag-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlanner, type PlannerData } from "@/hooks/usePlanner";
import type {
  Content,
  ContentCategory,
  DrinkData,
  MealData,
  PlanItem,
  SharedPlanItem,
  Tag,
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

type ShareableFriend = PlannerData["shareableFriends"][number];
type ContentWithTags = Content & { tags?: Tag[] };

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
  const [plannedTime, setPlannedTime] = useState("19:00");

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

  const openAddModal = (dayIndex: number) => {
    setPlannedTime("19:00");
    setAddingToDay(dayIndex);
  };

  const getPlannedDateTime = (dayIndex: number, timeValue: string) => {
    if (!weekStart) return null;
    const date = parseDateString(weekStart);
    date.setDate(date.getDate() + dayIndex);

    const [hours, minutes] = timeValue.split(":").map(Number);
    if (Number.isNaN(hours)) return null;

    const plannedUtc = new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hours,
        minutes || 0,
        0,
        0,
      ),
    );

    return plannedUtc.toISOString();
  };

  const addToDay = async (contentId: string, dayOfWeek: number) => {
    try {
      const plannedDate = getPlannedDateTime(dayOfWeek, plannedTime);
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          contentId,
          plannedDate,
        }),
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
      const plannedDate = getPlannedDateTime(dayOfWeek, plannedTime);
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          noteTitle: quickNoteInput.trim(),
          plannedDate,
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
      const shareableFriends: ShareableFriend[] = data?.shareableFriends || [];
      preSelectedFriendIds =
        shareableFriends
          .filter((f: ShareableFriend) =>
            currentlySharedUserIds.includes(f.linkedUserId)
          )
          .map((f: ShareableFriend) => f.id) || [];
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

  const getDayDateKey = (dayIndex: number) => {
    if (!weekStart) return null;
    const date = parseDateString(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return formatDateString(date);
  };

  const formatUtcDateString = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getItemDateKey = (item: DisplayItem) => {
    if (item.planned_date) {
      const planned = new Date(item.planned_date);
      if (!Number.isNaN(planned.getTime())) {
        return formatUtcDateString(planned);
      }
    }

    if ("shared_date" in item && item.shared_date) {
      return item.shared_date;
    }
    return null;
  };

  const formatItemTime = (item: DisplayItem) => {
    if (!item.planned_date) return null;
    const planned = new Date(item.planned_date);
    if (Number.isNaN(planned.getTime())) return null;
    return planned.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
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

    const planItems: PlanItemWithSharing[] = data.plan?.items || [];
    const availableContent: ContentWithTags[] = data.availableContent || [];
    const usedIds = new Set(planItems.map((i: PlanItemWithSharing) => i.content_id) || []);

    return availableContent.filter((c: ContentWithTags) => {
      if (usedIds.has(c.id)) return false;
      if (c.category === "gift_idea") return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;

      if (selectedTagIds.length > 0) {
        const contentTagIds = c.tags?.map((t: Tag) => t.id) || [];
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

    const allItems: (PlanItemWithSharing | SharedPlanItem)[] = [
      ...(data.plan.items || []),
      ...(data.sharedItems || []),
    ];

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
    const allItems: (PlanItemWithSharing | SharedPlanItem)[] = [
      ...(data.plan?.items || []),
      ...(data.sharedItems || []),
    ];
    return allItems.some(
      (item: PlanItemWithSharing | SharedPlanItem) =>
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

  const planItems: PlanItemWithSharing[] = data?.plan?.items || [];
  const sharedItemsList: SharedPlanItem[] = data?.sharedItems || [];
  const itemsByDay: Record<number, DisplayItem[]> = {};
  for (let i = 0; i <= 6; i++) {
    const dayKey = getDayDateKey(i);
    const ownItems: DisplayItem[] = (
      planItems.filter(
        (item: PlanItemWithSharing) =>
          dayKey && getItemDateKey(item as DisplayItem) === dayKey
      ) || []
    ).map((item: PlanItemWithSharing) => ({
      ...item,
      isSharedWithMe: false,
    }));

    const sharedItems: DisplayItem[] = (
      sharedItemsList.filter(
        (item: SharedPlanItem) =>
          dayKey && getItemDateKey(item as DisplayItem) === dayKey
      ) || []
    ).map((item: SharedPlanItem) => ({
      ...item,
      isSharedWithMe: true,
    }));

    itemsByDay[i] = [...ownItems, ...sharedItems];
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="hidden md:inline-flex">
            <Button variant="ghost" className="btn-ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="md:hidden w-16" />
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
                        <span className="text-base font-semibold text-[var(--primary)]">
                          {String(getDateForDay(dayIndex)).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-medium">
                          {DAYS_FULL[dayIndex]}
                        </span>
                        {isToday(dayIndex) && (
                          <Badge className="bg-[var(--primary)] text-white text-[10px]">
                            Today
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs rounded-lg hover:bg-[var(--muted)]"
                        onClick={() => openAddModal(dayIndex)}
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
                          const plannedTimeLabel = formatItemTime(item);

                          // Quick note display (mobile)
                          if (isQuickNote) {
                            return (
                              <div
                                key={item.id}
                                className="group relative bg-[var(--accent-light)] rounded-xl overflow-hidden p-3"
                              >
                                <div className="flex flex-col gap-1 pr-16">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <FileText className="w-4 h-4 text-[var(--accent)]" />
                                    {plannedTimeLabel && (
                                      <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded-full font-semibold text-[var(--accent)]">
                                        {plannedTimeLabel}
                                      </span>
                                    )}
                                    {isShared && (
                                      <span className="text-[10px] bg-[var(--muted)] px-1.5 py-0.5 rounded-full font-medium">
                                        from {sharedItem?.owner_name}
                                      </span>
                                    )}
                                    {ownItem?.shared_with &&
                                      ownItem.shared_with.length > 0 && (
                                        <span className="text-[10px] bg-[var(--secondary-light)] text-[var(--secondary-dark)] px-1.5 py-0.5 rounded-full font-medium">
                                          <Users className="w-3 h-3 inline mr-0.5" />
                                          {ownItem.shared_with.length}
                                        </span>
                                      )}
                                  </div>
                                  <p className="font-medium text-sm">
                                    {item.note_title}
                                  </p>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1">
                                  {isShared ? (
                                    <button
                                      onClick={() => leaveSharedItem(item.id)}
                                      className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                      title="Leave"
                                    >
                                      <Hand className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => openShareModal(ownItem!)}
                                        className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                        title="Share"
                                      >
                                        <Users className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => removeFromDay(item.id)}
                                        className="bg-[var(--destructive)] text-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm"
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
                              className="group relative bg-white rounded-xl overflow-hidden border border-[var(--border)]"
                            >
                              <Link
                                href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                                className="flex gap-3"
                              >
                                {item.content?.thumbnail_url && (
                                  <img
                                    src={item.content.thumbnail_url}
                                    alt=""
                                    className="w-20 h-20 object-cover shrink-0 rounded-l-xl"
                                  />
                                )}
                                <div className="flex-1 py-2 pr-16 min-w-0">
                                <div className="flex flex-col gap-1 mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground capitalize">
                                      {item.content?.category?.replace("_", " ")}
                                    </span>
                                    {plannedTimeLabel && (
                                      <span className="text-[10px] bg-[var(--accent-light)] text-[var(--accent-foreground)] px-2 py-0.5 rounded-full font-semibold">
                                        {plannedTimeLabel}
                                      </span>
                                    )}
                                    {isShared && (
                                      <span className="text-[10px] bg-[var(--muted)] px-1.5 py-0.5 rounded-full font-medium">
                                        from {sharedItem?.owner_name}
                                      </span>
                                    )}
                                    {ownItem?.shared_with &&
                                      ownItem.shared_with.length > 0 && (
                                        <span className="text-[10px] bg-[var(--secondary-light)] text-[var(--secondary-dark)] px-1.5 py-0.5 rounded-full font-medium">
                                          <Users className="w-3 h-3 inline mr-0.5" />
                                          {ownItem.shared_with.length}
                                        </span>
                                      )}
                                  </div>
                                  <p className="font-medium text-sm line-clamp-2">
                                    {item.content?.title}
                                  </p>
                                </div>
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
                                    className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
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
                                      className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
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
                                      className="bg-[var(--destructive)] text-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm"
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
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No plans yet
                      </div>
                    )}
                  </div>
                </div>
                {/* Desktop Layout */}
                <div className="hidden md:block">
                  <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-semibold text-[var(--primary)]">
                          {String(getDateForDay(dayIndex)).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {DAYS[dayIndex]}
                        </span>
                      </div>
                      {isToday(dayIndex) && (
                        <Badge className="bg-[var(--primary)] text-white text-[10px]">
                          Today
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-2 space-y-2 min-h-[160px] bg-white rounded-b-2xl">
                    {itemsByDay[dayIndex].map((item) => {
                      const isShared = item.isSharedWithMe;
                      const sharedItem = isShared
                        ? (item as SharedPlanItem)
                        : null;
                      const ownItem = !isShared
                        ? (item as PlanItemWithSharing)
                        : null;
                      const isQuickNote = !item.content_id && item.note_title;
                      const plannedTimeLabel = formatItemTime(item);

                      // Quick note (desktop)
                      if (isQuickNote) {
                        return (
                          <div
                            key={item.id}
                            className="group relative bg-[var(--accent-light)] rounded-lg overflow-hidden p-2"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <FileText className="w-3 h-3 text-[var(--accent)]" />
                                {plannedTimeLabel && (
                                  <span className="text-[8px] bg-white/70 px-1.5 py-0.5 rounded-full font-semibold text-[var(--accent)]">
                                    {plannedTimeLabel}
                                  </span>
                                )}
                                {isShared && (
                                  <span className="text-[8px] bg-white/60 px-1 py-0.5 rounded font-medium">
                                    {sharedItem?.owner_name}
                                  </span>
                                )}
                                {ownItem?.shared_with &&
                                  ownItem.shared_with.length > 0 && (
                                    <span className="text-[8px] bg-[var(--secondary-light)] text-[var(--secondary-dark)] px-1 py-0.5 rounded font-medium">
                                      <Users className="w-2 h-2 inline" />{" "}
                                      {ownItem.shared_with.length}
                                    </span>
                                  )}
                              </div>
                              <p className="text-xs font-medium line-clamp-2">
                                {item.note_title}
                              </p>
                            </div>
                            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isShared ? (
                                <button
                                  onClick={() => leaveSharedItem(item.id)}
                                  className="bg-white rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
                                  title="Leave"
                                >
                                  <Hand className="w-3 h-3" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => openShareModal(ownItem!)}
                                    className="bg-white rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
                                    title="Share"
                                  >
                                    <Users className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeFromDay(item.id)}
                                    className="bg-[var(--destructive)] text-white rounded w-5 h-5 text-[10px] flex items-center justify-center"
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
                          className="group relative bg-white rounded-lg overflow-hidden border border-[var(--border)]"
                        >
                          <Link
                            href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                            className="block"
                          >
                            {item.content?.thumbnail_url && (
                              <img
                                src={item.content.thumbnail_url}
                                alt=""
                                className="w-full h-20 object-cover"
                              />
                            )}
                            <div className="p-2">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Icon className="w-3 h-3 text-muted-foreground" />
                                  {plannedTimeLabel && (
                                    <span className="text-[8px] bg-[var(--accent-light)] text-[var(--accent-foreground)] px-1.5 py-0.5 rounded-full font-semibold">
                                      {plannedTimeLabel}
                                    </span>
                                  )}
                                  {isShared && (
                                    <span className="text-[8px] bg-[var(--muted)] px-1 py-0.5 rounded font-medium">
                                      {sharedItem?.owner_name}
                                    </span>
                                  )}
                                  {ownItem?.shared_with &&
                                    ownItem.shared_with.length > 0 && (
                                      <span className="text-[8px] bg-[var(--secondary-light)] text-[var(--secondary-dark)] px-1 py-0.5 rounded font-medium">
                                        <Users className="w-2 h-2 inline" />{" "}
                                        {ownItem.shared_with.length}
                                      </span>
                                    )}
                                </div>
                                <p className="text-xs font-medium line-clamp-2">
                                  {item.content?.title}
                                </p>
                              </div>
                            </div>
                          </Link>
                          <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isShared ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  leaveSharedItem(item.id);
                                }}
                                className="bg-white/90 backdrop-blur rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
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
                                  className="bg-white/90 backdrop-blur rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
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
                                  className="bg-[var(--destructive)] text-white rounded w-5 h-5 text-[10px] flex items-center justify-center"
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
                      className="w-full h-7 text-xs border border-dashed border-[var(--border)] rounded-lg hover:bg-[var(--muted)] text-muted-foreground"
                      onClick={() => openAddModal(dayIndex)}
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
              <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)]">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
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
                    className="input-modern flex-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    className="btn-primary"
                    disabled={!quickNoteInput.trim() || addingQuickNote}
                  >
                    {addingQuickNote ? "..." : "Add"}
                  </Button>
                </form>
                <div className="mt-3 flex items-center gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Time
                  </div>
                  <Input
                    type="time"
                    value={plannedTime}
                    onChange={(e) => setPlannedTime(e.target.value)}
                    className="input-modern max-w-[140px]"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Default 7:00 PM
                  </span>
                </div>
              </div>

              <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-[var(--muted)] border-b border-[var(--border)]">
                Or pick from saved items
              </div>

              {/* Search & Filters */}
              <div className="p-4 border-b border-[var(--border)] space-y-3 sticky top-0 bg-white z-10">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search saved items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-modern flex-1"
                  />
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="shrink-0 text-xs text-destructive hover:bg-red-50 rounded-lg"
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
                    <button
                      key={cat.id}
                      onClick={() =>
                        setCategoryFilter(cat.id as ContentCategory | "all")
                      }
                      className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                        categoryFilter === cat.id
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {cat.icon && <cat.icon className="w-3 h-3" />}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag filters */}
              {data?.allTags && data.allTags.length > 0 && (
                <div className="px-4 py-3 border-b border-[var(--border)]">
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
                {getFilteredContent().map((content: ContentWithTags) => {
                  const Icon = CATEGORY_ICONS[content.category] || Pin;
                  return (
                    <button
                      key={content.id}
                      onClick={() => addToDay(content.id, addingToDay)}
                      className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-left flex items-center gap-3 hover:border-[var(--primary)]/30 hover:shadow-sm transition-all"
                    >
                      {content.thumbnail_url && (
                        <img
                          src={content.thumbnail_url}
                          alt=""
                          className="w-14 h-14 object-cover shrink-0 rounded-lg"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium line-clamp-1">
                            {content.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">
                          {content.category.replace("_", " ")}
                        </p>
                        {content.tags && content.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                          {content.tags.slice(0, 3).map((tag: Tag) => (
                              <span
                                key={tag.id}
                                className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-light)] rounded-full"
                              >
                                {tag.name}
                              </span>
                            ))}
                            {content.tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
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
                    <p className="text-sm font-medium">No items found</p>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="mt-2 btn-ghost text-xs"
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
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] rounded-t-2xl">
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
                  className="text-white hover:bg-white/10 rounded-lg"
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
                  className="text-white hover:bg-white/10 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {groceryList.loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="loading-spinner mb-4" />
                  <p className="text-muted-foreground text-sm">
                    Generating list...
                  </p>
                </div>
              )}

              {groceryList.error && !groceryList.loading && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <X className="w-6 h-6 text-destructive" />
                  </div>
                  <p className="text-muted-foreground text-center text-sm">
                    {groceryList.error}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4 btn-ghost"
                    onClick={() =>
                      setGroceryList((s) => ({ ...s, isOpen: false }))
                    }
                  >
                    Close
                  </Button>
                </div>
              )}

              {!groceryList.loading && !groceryList.error && (
                <div ref={groceryListRef} className="p-4">
                  {groceryList.items.length > 0 ? (
                    <>
                      {(() => {
                        const categories = [
                          ...new Set(groceryList.items.map((i) => i.category)),
                        ];
                        return categories.map((category) => (
                          <div key={category} className="mb-5">
                            <h4 className="font-semibold text-sm text-[var(--primary)] mb-2 pb-1 border-b border-[var(--border)]">
                              {category}
                            </h4>
                            <ul className="space-y-1">
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
                                      className="w-full text-left flex items-start gap-3 hover:bg-[var(--muted)] p-2 rounded-lg -mx-2 transition-colors"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[var(--primary)] text-xs">•</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                          <span className="font-medium text-sm">
                                            {item.ingredient}
                                          </span>
                                          {item.quantity && (
                                            <span className="text-xs text-muted-foreground">
                                              ({item.quantity})
                                            </span>
                                          )}
                                        </div>
                                        {item.notes && (
                                          <p className="text-xs text-muted-foreground italic mt-0.5">
                                            {item.notes}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          For: {item.sources.map((s) => s.title).join(", ")}
                                        </p>
                                      </div>
                                      {groceryList.expandedIngredient ===
                                      item.ingredient ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                      )}
                                    </button>

                                    {groceryList.expandedIngredient ===
                                      item.ingredient && (
                                      <div className="ml-8 mt-1 mb-2 p-3 bg-[var(--muted)] rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                          Used in:
                                        </p>
                                        {item.sources.map((source, sIndex) => (
                                          <Link
                                            key={sIndex}
                                            href={`/dashboard/${source.id}?from=planner&week=${weekStart}`}
                                            className="block text-sm text-[var(--primary)] hover:underline py-0.5"
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
                        <div className="mt-4 pt-4 border-t border-[var(--border)]">
                          <h4 className="font-semibold text-sm mb-2">
                            Shopping Tips
                          </h4>
                          <ul className="space-y-1.5">
                            {groceryList.tips.map((tip, index) => (
                              <li
                                key={index}
                                className="text-xs text-muted-foreground flex gap-2"
                              >
                                <span className="text-[var(--primary)]">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--muted)] flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-sm">
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
                      {data.shareableFriends.map((friend: ShareableFriend) => {
                        const isSelected = itemShare.selectedFriendIds.includes(
                          friend.id
                        );
                        return (
                          <button
                            key={friend.id}
                            onClick={() => toggleFriendSelection(friend.id)}
                            className={`w-full p-3 text-left flex items-center gap-3 transition-all rounded-xl border ${
                              isSelected
                                ? "bg-[var(--primary)]/5 border-[var(--primary)]"
                                : "bg-white border-[var(--border)] hover:border-[var(--primary)]/30"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                                isSelected ? "bg-[var(--primary)]/10" : "bg-[var(--muted)]"
                              }`}
                            >
                              {friend.isFavorite ? (
                                <Star className={`w-5 h-5 ${isSelected ? "text-[var(--primary)]" : ""}`} />
                              ) : (
                                <User className={`w-5 h-5 ${isSelected ? "text-[var(--primary)]" : ""}`} />
                              )}
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
                              <Check className="w-5 h-5 text-[var(--primary)]" />
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
                    className="w-full p-3 text-left flex items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/30 hover:bg-[var(--muted)]/50 transition-colors"
                  >
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--muted)]">
                      <Plus className="w-5 h-5" />
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
                      <label className="text-sm font-medium mb-1.5 block">
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
                        className="input-modern"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
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
                        className="input-modern"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        If they have Planning Friend, they&apos;ll be linked
                        automatically.
                      </p>
                    </div>

                    <Button
                      onClick={addNewFriend}
                      disabled={
                        itemShare.loading || !itemShare.newFriendName.trim()
                      }
                      className="btn-primary w-full"
                    >
                      {itemShare.loading ? "Adding..." : "Add Friend"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {!itemShare.showAddFriend && (
              <div className="p-4 border-t border-[var(--border)] space-y-3">
                {itemShare.error && (
                  <p className="text-sm text-destructive text-center">
                    {itemShare.error}
                  </p>
                )}
                {itemShare.success && (
                  <p className="text-sm text-[var(--primary)] text-center">
                    {itemShare.success}
                  </p>
                )}
                <Button
                  onClick={shareItem}
                  disabled={
                    itemShare.loading ||
                    itemShare.selectedFriendIds.length === 0
                  }
                  className="btn-primary w-full"
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
