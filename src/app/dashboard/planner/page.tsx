"use client";

import { TagFilter } from "@/components/tag-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLANNER_LIBRARY_KEY,
  plannerWeekKey,
  usePlanner,
  usePlannerLibrary,
  type PlanItemWithSharing,
  type ShareableFriend,
} from "@/hooks/usePlanner";
import type {
  Content,
  ContentCategory,
  DrinkData,
  MealData,
  SharedPlanItem,
  Tag,
} from "@/lib/supabase";
import {
  formatDateString,
  getDateSlotInWeek,
  getOrderedDays,
  getWeekStartDay,
  getWeekStartForDate,
  parseDateString,
} from "@/lib/date-utils";
import html2canvas from "html2canvas";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Heart,
  Plus,
  ShoppingCart,
  Star,
  User,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSWRConfig } from "swr";
import { useSession } from "../useSession";
import { categoryUI } from "@/lib/categories";
import { DateJumpControls } from "./components/DateJumpControls";
import { PlannerSearch } from "./components/PlannerSearch";
import { SuggestionStrip } from "./components/SuggestionStrip";
import { WeekSection } from "./components/WeekSection";
import { getItemDateKey } from "@/lib/plan-dates";
import { usePlannerFilters } from "./hooks/usePlannerFilters";

interface ItemShareState {
  isOpen: boolean;
  itemId: string | null;
  itemTitle: string;
  /** Week the item belongs to, for cache revalidation after sharing */
  itemWeek: string | null;
  selectedFriendIds: string[];
  loading: boolean;
  error: string;
  success: string;
  showAddFriend: boolean;
  newFriendName: string;
  newFriendPhone: string;
}

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

interface UndoState {
  itemId: string;
  week: string;
  contentTitle: string;
  expiresAt: number;
}

interface PendingScroll {
  dateKey: string;
  smooth: boolean;
}

function addWeeksTo(weekStart: string, count: number): string {
  const date = parseDateString(weekStart);
  date.setDate(date.getDate() + count * 7);
  return formatDateString(date);
}

function PlannerContent() {
  const [anchorDate, setAnchorDate] = useState<string>("");
  const [weeks, setWeeks] = useState<string[]>([]);
  const [pendingScroll, setPendingScroll] = useState<PendingScroll | null>(
    null,
  );
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  const [addingToDate, setAddingToDate] = useState<string | null>(null);
  const [quickNoteInput, setQuickNoteInput] = useState("");
  const [addingQuickNote, setAddingQuickNote] = useState(false);
  const [plannedTime, setPlannedTime] = useState("19:00");
  const [editingItem, setEditingItem] = useState<PlanItemWithSharing | null>(
    null,
  );
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  // Week start day preference (0=Sunday, 1=Monday, etc.)
  const weekStartDay = useMemo(() => getWeekStartDay(), []);

  // Dynamic day name arrays based on user's week start preference
  const { days: DAYS, daysFull: DAYS_FULL } = useMemo(
    () => getOrderedDays(weekStartDay),
    [weekStartDay],
  );

  const {
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    selectedTagIds,
    setSelectedTagIds,
    clearAllFilters,
    toggleTagSelection,
  } = usePlannerFilters();

  const [itemShare, setItemShare] = useState<ItemShareState>({
    isOpen: false,
    itemId: null,
    itemTitle: "",
    itemWeek: null,
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

  const { mutate: globalMutate } = useSWRConfig();

  const weekOf = useCallback(
    (dateKey: string) =>
      getWeekStartForDate(parseDateString(dateKey), weekStartDay),
    [weekStartDay],
  );

  /** Revalidate the SWR cache for the week containing dateKey. */
  const revalidateWeek = useCallback(
    (week: string) => globalMutate(plannerWeekKey(week)),
    [globalMutate],
  );
  const revalidateDate = useCallback(
    (dateKey: string) => revalidateWeek(weekOf(dateKey)),
    [revalidateWeek, weekOf],
  );

  // Week-independent data: content library, tags, shareable friends.
  const { data: library } = usePlannerLibrary({ enabled: !!user });

  // Week the anchor date belongs to — drives the grocery list.
  const anchorWeek = anchorDate ? weekOf(anchorDate) : null;
  const { data } = usePlanner(anchorWeek, {
    enabled: !!user && !!anchorWeek,
  });

  // Week the add/edit modal is targeting (for per-day suggestions and
  // already-planned filtering).
  const modalWeek = addingToDate ? weekOf(addingToDate) : null;
  const { data: modalData } = usePlanner(modalWeek, {
    enabled: !!user && !!modalWeek,
  });
  const modalDayIndex =
    addingToDate && modalWeek
      ? getDateSlotInWeek(addingToDate, modalWeek)
      : -1;

  // ============================================
  // Infinite scroll + focus management
  // ============================================

  const headerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const dayElementsRef = useRef(new Map<string, HTMLElement>());
  const weeksRef = useRef<string[]>([]);
  weeksRef.current = weeks;
  const prependAnchorRef = useRef<{ key: string; top: number } | null>(null);
  const suppressSpyUntilRef = useRef(0);
  const focusHoldRef = useRef<{ dateKey: string; until: number } | null>(null);

  const registerDayElement = useCallback(
    (dateKey: string, el: HTMLElement | null) => {
      if (el) {
        dayElementsRef.current.set(dateKey, el);
      } else {
        dayElementsRef.current.delete(dateKey);
      }
    },
    [],
  );

  const getHeaderOffset = () =>
    (headerRef.current?.getBoundingClientRect().height ?? 0) + 12;

  const scrollToDate = useCallback((dateKey: string, smooth: boolean) => {
    const el = dayElementsRef.current.get(dateKey);
    if (!el) return;
    const top = Math.max(
      el.getBoundingClientRect().top + window.scrollY - getHeaderOffset(),
      0,
    );
    // Animate only short hops — a long smooth scroll outlives the
    // scroll-spy suppression window and drags the selectors through
    // every week in between.
    const isNearby =
      Math.abs(top - window.scrollY) < window.innerHeight * 2.5;
    window.scrollTo({
      top,
      behavior: smooth && isNearby ? "smooth" : "auto",
    });
  }, []);

  /**
   * Move focus to a date: update selectors, make sure its week is
   * mounted, and scroll it to the top of the page.
   */
  const jumpToDate = useCallback(
    (
      dateKey: string,
      opts?: { smooth?: boolean; updateUrl?: boolean; highlight?: boolean },
    ) => {
      const { smooth = true, updateUrl = true, highlight = false } =
        opts ?? {};
      const week = weekOf(dateKey);
      const alreadyMounted = weeksRef.current.includes(week);

      setAnchorDate(dateKey);
      if (!alreadyMounted) {
        // Rebuild the window of weeks around the target date.
        setWeeks([week, addWeeksTo(week, 1), addWeeksTo(week, 2)]);
      }
      const useSmooth = alreadyMounted && smooth;
      setPendingScroll({ dateKey, smooth: useSmooth });
      suppressSpyUntilRef.current = Date.now() + (useSmooth ? 1500 : 300);

      if (highlight) setHighlightDate(dateKey);

      if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("date", dateKey);
        url.searchParams.delete("week");
        window.history.replaceState({}, "", url.toString());
      }
    },
    [weekOf],
  );

  // Initialize focus from URL (?date= or legacy ?week=) or today.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const urlDate = searchParams.get("date") || searchParams.get("week");
    const target =
      urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)
        ? urlDate
        : formatDateString(new Date());
    jumpToDate(target, { smooth: false, updateUrl: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // False while the early-return loading screen is up — the week grid
  // (day cards, sentinels) isn't mounted until this flips true.
  const contentReady = !sessionLoading && !!anchorDate;

  // Compensate scroll position when a past week is prepended, so the
  // content the user is looking at doesn't move. Measured against the
  // previously-first day card's actual position, so it stays correct
  // whether or not the browser's native scroll anchoring also kicks in.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    if (!anchor) return;
    prependAnchorRef.current = null;
    const el = dayElementsRef.current.get(anchor.key);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - anchor.top;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [weeks]);

  // After an instant jump, hold the target in place for a moment: week
  // data streaming in above the viewport reflows the page, and browser
  // scroll anchoring alone doesn't reliably keep the target pinned.
  const startFocusHold = useCallback(
    (dateKey: string) => {
      // Generous window: it only pins while the user hasn't interacted
      // (any wheel/touch/key/mouse input releases the hold immediately).
      focusHoldRef.current = { dateKey, until: Date.now() + 8000 };
      const step = () => {
        const hold = focusHoldRef.current;
        if (!hold || hold.dateKey !== dateKey) return;
        if (Date.now() > hold.until) {
          focusHoldRef.current = null;
          return;
        }
        const el = dayElementsRef.current.get(dateKey);
        if (el) {
          const desired = Math.max(
            el.getBoundingClientRect().top + window.scrollY - getHeaderOffset(),
            0,
          );
          if (Math.abs(desired - window.scrollY) > 1) {
            window.scrollTo({ top: desired });
          }
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [],
  );

  // Any real user input releases the focus hold.
  useEffect(() => {
    const release = () => {
      focusHoldRef.current = null;
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);
    window.addEventListener("mousedown", release);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
      window.removeEventListener("mousedown", release);
    };
  }, []);

  // Execute a pending programmatic scroll once the target day has
  // rendered (the loading screen may still be up when the jump is made).
  useLayoutEffect(() => {
    if (!pendingScroll) return;
    if (!dayElementsRef.current.has(pendingScroll.dateKey)) return;
    scrollToDate(pendingScroll.dateKey, pendingScroll.smooth);
    if (!pendingScroll.smooth) startFocusHold(pendingScroll.dateKey);
    setPendingScroll(null);
  }, [pendingScroll, contentReady, scrollToDate, startFocusHold]);

  const prependWeek = useCallback(() => {
    if (prependAnchorRef.current) return;
    const firstWeek = weeksRef.current[0];
    if (!firstWeek) return;
    const el = dayElementsRef.current.get(firstWeek);
    if (!el) return;
    prependAnchorRef.current = {
      key: firstWeek,
      top: el.getBoundingClientRect().top,
    };
    setWeeks((prev) =>
      prev.length ? [addWeeksTo(prev[0], -1), ...prev] : prev,
    );
  }, []);

  const appendWeek = useCallback(() => {
    setWeeks((prev) =>
      prev.length ? [...prev, addWeeksTo(prev[prev.length - 1], 1)] : prev,
    );
  }, []);

  // Sentinel observers: extend the list of weeks in either direction as
  // the user approaches the edges. `contentReady` matters: while the
  // page shows the loading screen the sentinels aren't mounted, so the
  // observers must (re)attach once the real layout renders.
  useEffect(() => {
    if (!contentReady || weeks.length === 0) return;
    const top = topSentinelRef.current;
    const bottom = bottomSentinelRef.current;
    if (!top || !bottom) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === top) prependWeek();
          else if (entry.target === bottom) appendWeek();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(top);
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [contentReady, weeks, prependWeek, appendWeek]);

  // Scroll-spy: keep the month/day/year selectors in sync with the day
  // at the top of the viewport.
  const updateAnchorFromScroll = useCallback(() => {
    if (focusHoldRef.current) return;
    if (Date.now() < suppressSpyUntilRef.current) return;
    const headerBottom =
      headerRef.current?.getBoundingClientRect().bottom ?? 0;
    let bestKey: string | null = null;
    let bestTop = Infinity;
    for (const [key, el] of dayElementsRef.current) {
      const rect = el.getBoundingClientRect();
      // A day only counts as "at the top" once a meaningful slice of it
      // is visible — otherwise a few peeking pixels of the previous day
      // win over the day the user actually scrolled to.
      if (rect.bottom <= headerBottom + 40) continue;
      if (rect.top < bestTop - 1) {
        bestTop = rect.top;
        bestKey = key;
      }
    }
    if (!bestKey) return;
    const nextKey = bestKey;
    setAnchorDate((prev) => {
      if (prev === nextKey) return prev;
      // On desktop the whole week sits on one row, so the topmost day is
      // always the week's first day. Keep the currently selected day
      // while the user is still within the same week.
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop && prev && weekOf(prev) === weekOf(nextKey)) return prev;
      return nextKey;
    });
  }, [weekOf]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateAnchorFromScroll();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [updateAnchorFromScroll]);

  // Clear the search-result highlight after a moment.
  useEffect(() => {
    if (!highlightDate) return;
    const t = setTimeout(() => setHighlightDate(null), 2500);
    return () => clearTimeout(t);
  }, [highlightDate]);

  // ============================================
  // Item actions
  // ============================================

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

  const openAddModal = (dateKey: string) => {
    setPlannedTime("19:00");
    setEditingItem(null);
    setQuickNoteInput("");
    setAddingToDate(dateKey);
  };

  const closeAddModal = () => {
    setAddingToDate(null);
    setEditingItem(null);
    setAddingQuickNote(false);
  };

  const getTimeInputValue = (plannedDate?: string | null) => {
    if (!plannedDate) return "19:00";
    const planned = new Date(plannedDate);
    if (Number.isNaN(planned.getTime())) return "19:00";
    const hours = String(planned.getUTCHours()).padStart(2, "0");
    const minutes = String(planned.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const openEditModal = (item: PlanItemWithSharing, dateKey: string) => {
    setEditingItem(item);
    setPlannedTime(getTimeInputValue(item.planned_date));
    setQuickNoteInput(item.note_title || "");
    setAddingToDate(dateKey);
  };

  const getPlannedDateTime = (dateKey: string, timeValue: string) => {
    const date = parseDateString(dateKey);
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

  const removeFromDay = async (itemId: string, week: string) => {
    try {
      const res = await fetch(`/api/planner/item?id=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        revalidateWeek(week);
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const deleteEditingItem = async () => {
    if (!editingItem || !addingToDate) return;
    await removeFromDay(editingItem.id, weekOf(addingToDate));
    closeAddModal();
  };

  const addToDay = async (contentId: string, dateKey: string) => {
    try {
      const plannedDate = getPlannedDateTime(dateKey, plannedTime);
      if (!plannedDate) return;
      if (editingItem) {
        const res = await fetch("/api/planner/item", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            contentId,
            plannedDate,
          }),
        });

        if (res.ok) {
          revalidateDate(dateKey);
        }
        closeAddModal();
        return;
      }
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          plannedDate,
        }),
      });

      if (res.ok) {
        revalidateDate(dateKey);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
    setAddingToDate(null);
  };

  const addQuickNote = async (dateKey: string) => {
    if (!quickNoteInput.trim()) return;

    setAddingQuickNote(true);
    try {
      const plannedDate = getPlannedDateTime(dateKey, plannedTime);
      if (!plannedDate) return;
      if (editingItem) {
        const res = await fetch("/api/planner/item", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            noteTitle: quickNoteInput.trim(),
            plannedDate,
          }),
        });

        if (res.ok) {
          setQuickNoteInput("");
          revalidateDate(dateKey);
          closeAddModal();
        }
        return;
      }
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteTitle: quickNoteInput.trim(),
          plannedDate,
        }),
      });

      if (res.ok) {
        setQuickNoteInput("");
        revalidateDate(dateKey);
        setAddingToDate(null);
      }
    } catch (error) {
      console.error("Failed to add quick note:", error);
    } finally {
      setAddingQuickNote(false);
    }
  };

  const saveEditingContent = async () => {
    if (!editingItem || !editingItem.content_id) return;
    if (!addingToDate) return;
    try {
      const plannedDate = getPlannedDateTime(addingToDate, plannedTime);
      if (!plannedDate) return;
      const res = await fetch("/api/planner/item", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          contentId: editingItem.content_id,
          plannedDate,
        }),
      });

      if (res.ok) {
        revalidateDate(addingToDate);
        closeAddModal();
      }
    } catch (error) {
      console.error("Failed to update item:", error);
    }
  };

  // ============================================
  // Suggestions
  // ============================================

  const contentById = useMemo(() => {
    const map = new Map<string, ContentWithTags>();
    for (const c of library?.availableContent ?? []) {
      map.set(c.id, c as ContentWithTags);
    }
    return map;
  }, [library?.availableContent]);

  // Auto-dismiss the undo pill after expiration.
  useEffect(() => {
    if (!undoState) return;
    const remaining = undoState.expiresAt - Date.now();
    if (remaining <= 0) {
      setUndoState(null);
      return;
    }
    const t = setTimeout(() => setUndoState(null), remaining);
    return () => clearTimeout(t);
  }, [undoState]);

  const getDismissKey = (week: string, dayIndex: number, contentId: string) =>
    `${week}:${dayIndex}:${contentId}`;

  const addSuggestionToDay = async (
    contentId: string,
    dayIndex: number,
    week: string,
  ) => {
    const date = parseDateString(week);
    date.setDate(date.getDate() + dayIndex);
    const plannedDate = getPlannedDateTime(formatDateString(date), "19:00");
    if (!plannedDate) return;
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          plannedDate,
          source: "ai_suggested",
        }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as { item?: { id: string } };
      const itemId = body.item?.id;
      const content = contentById.get(contentId);
      if (itemId) {
        setUndoState({
          itemId,
          week,
          contentTitle: content?.title ?? "Suggestion",
          expiresAt: Date.now() + 4500,
        });
      }
      revalidateWeek(week);
    } catch (err) {
      console.error("Failed to add suggestion:", err);
    }
  };

  const undoLastAdd = async () => {
    if (!undoState) return;
    const target = undoState;
    setUndoState(null);
    try {
      await fetch(`/api/planner/item?id=${target.itemId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to undo add:", err);
    }
    revalidateWeek(target.week);
  };

  const dismissSuggestion = async (
    contentId: string,
    dayIndex: number,
    week: string,
  ) => {
    setDismissedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(getDismissKey(week, dayIndex, contentId));
      return next;
    });
    try {
      await fetch(
        `/api/planner/suggestions?week=${encodeURIComponent(
          week,
        )}&day=${dayIndex}&contentId=${encodeURIComponent(contentId)}`,
        { method: "DELETE" },
      );
    } catch (err) {
      console.error("Failed to dismiss suggestion:", err);
    }
  };

  const refreshDaySuggestions = async (dayIndex: number, week: string) => {
    setRefreshingKey(`${week}:${dayIndex}`);
    try {
      const res = await fetch("/api/planner/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: week, dayIndex }),
      });
      if (res.ok) {
        await revalidateWeek(week);
      }
    } catch (err) {
      console.error("Failed to refresh suggestions:", err);
    } finally {
      setRefreshingKey(null);
    }
  };

  const modalPicks = useMemo(() => {
    if (!modalWeek || modalDayIndex < 0) return [];
    const list = modalData?.suggestions?.[modalDayIndex] ?? [];
    return list.filter(
      (p) =>
        !dismissedSuggestions.has(
          getDismissKey(modalWeek, modalDayIndex, p.contentId),
        ),
    );
  }, [modalWeek, modalDayIndex, modalData?.suggestions, dismissedSuggestions]);

  // ============================================
  // Sharing
  // ============================================

  // Open share modal for an item
  const openShareModal = (item: PlanItemWithSharing) => {
    const currentlySharedUserIds = item.shared_with?.map((s) => s.userId) || [];
    let preSelectedFriendIds: string[] = [];

    if (currentlySharedUserIds.length > 0) {
      const shareableFriends: ShareableFriend[] =
        library?.shareableFriends || [];
      preSelectedFriendIds =
        shareableFriends
          .filter((f: ShareableFriend) =>
            currentlySharedUserIds.includes(f.linkedUserId),
          )
          .map((f: ShareableFriend) => f.id) || [];
    } else {
      preSelectedFriendIds = getLastSharedFriendIds();
    }

    const itemTitle = item.note_title || item.content?.title || "Item";
    const itemDateKey = getItemDateKey(item);

    setItemShare({
      isOpen: true,
      itemId: item.id,
      itemTitle,
      itemWeek: itemDateKey ? weekOf(itemDateKey) : null,
      selectedFriendIds: preSelectedFriendIds,
      loading: false,
      error: "",
      success: "",
      showAddFriend: false,
      newFriendName: "",
      newFriendPhone: "",
    });
  };

  // Materialize an auto-injected event into a real plan item, then share it
  const shareAutoEvent = async (item: PlanItemWithSharing, week: string) => {
    if (!item.is_auto_event || !item.content_id) {
      openShareModal(item);
      return;
    }
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.content_id,
          plannedDate: item.planned_date,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        await revalidateWeek(week);
        openShareModal({
          ...result.item,
          is_owner: true,
          is_auto_event: false,
        } as PlanItemWithSharing);
      }
    } catch (error) {
      console.error("Failed to materialize auto-event:", error);
    }
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

      if (itemShare.itemWeek) revalidateWeek(itemShare.itemWeek);

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
  const leaveSharedItem = async (itemId: string, week: string) => {
    try {
      const res = await fetch(`/api/planner/item/share?itemId=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        revalidateWeek(week);
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

      // Refresh the shareable-friends list
      globalMutate(PLANNER_LIBRARY_KEY);

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

  // ============================================
  // Add-modal content filtering
  // ============================================

  const hasActiveFilters =
    searchQuery || categoryFilter !== "all" || selectedTagIds.length > 0;

  const getFilteredContent = () => {
    if (!library?.availableContent) return [];

    // keepPreviousData means modalData can briefly belong to another week;
    // only trust its plan items for used-item filtering once it matches.
    const modalReady =
      !!modalData && modalData.plan?.week_start === modalWeek;
    const planItems: PlanItemWithSharing[] = modalReady
      ? modalData.plan?.items || []
      : [];
    const availableContent: ContentWithTags[] =
      library.availableContent as ContentWithTags[];
    const usedIds = new Set(
      planItems.map((i: PlanItemWithSharing) => i.content_id) || [],
    );

    return availableContent.filter((c: ContentWithTags) => {
      if (usedIds.has(c.id)) return false;
      if (c.category === "gift_idea") return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;

      if (selectedTagIds.length > 0) {
        const contentTagIds = c.tags?.map((t: Tag) => t.id) || [];
        const hasMatchingTag = selectedTagIds.some((tagId) =>
          contentTagIds.includes(tagId),
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

  // ============================================
  // Grocery list (for the week currently in focus)
  // ============================================

  const formatWeekRange = () => {
    if (!anchorWeek) return "";
    const start = parseDateString(anchorWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${formatDate(start)} - ${formatDate(end)}`;
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
        body: JSON.stringify({ recipes, weekStart: anchorWeek }),
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
      link.download = `grocery-list-${anchorWeek}.png`;
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
        item.content?.category === "meal" || item.content?.category === "drink",
    );
  }, [data?.plan?.items, data?.sharedItems]);

  const todayKey = formatDateString(new Date());

  const formatModalDayLabel = (dateKey: string) =>
    parseDateString(dateKey).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  if (sessionLoading || !anchorDate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            Loading your planner...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div
        ref={headerRef}
        className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-20"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="hidden md:inline-flex">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="md:hidden w-16" />
          <h1 className="heading-2 text-xl md:text-2xl">Planner</h1>
          <Button
            variant="ghost"
            onClick={generateGroceryList}
            disabled={!hasMealOrDrinkItems}
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

        {/* Date jump + search controls */}
        <div className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-2">
          <DateJumpControls
            anchorDate={anchorDate}
            onJump={(dateKey) => jumpToDate(dateKey)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => jumpToDate(todayKey)}
            className="h-9 shrink-0"
            disabled={anchorDate === todayKey}
          >
            Today
          </Button>
          <PlannerSearch
            onJump={(dateKey) => jumpToDate(dateKey, { highlight: true })}
          />
        </div>

        {/* Calendar weekday columns (desktop) */}
        <div className="hidden md:block border-t border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 grid grid-cols-7 gap-3">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Empty State */}
        {library?.availableContent?.length === 0 && (
          <Card className="p-8 mb-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-2">No saved content yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Text TikTok or Instagram links to save meals, events, and date
              ideas.
            </p>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </Card>
        )}

        {/* Infinite week list */}
        <div>
          <div ref={topSentinelRef} aria-hidden className="h-px" />
          {weeks.map((week) => (
            <WeekSection
              key={week}
              weekStart={week}
              enabled={!!user}
              days={DAYS}
              daysFull={DAYS_FULL}
              contentById={contentById}
              highlightDate={highlightDate}
              dismissedSuggestions={dismissedSuggestions}
              refreshingKey={refreshingKey}
              registerDayElement={registerDayElement}
              onOpenAdd={openAddModal}
              onOpenEdit={openEditModal}
              onOpenShare={openShareModal}
              onLeaveShared={leaveSharedItem}
              onShareAutoEvent={shareAutoEvent}
              onAddSuggestion={addSuggestionToDay}
              onDismissSuggestion={dismissSuggestion}
              onRefreshSuggestions={refreshDaySuggestions}
            />
          ))}
          <div ref={bottomSentinelRef} aria-hidden className="h-px" />
        </div>
      </div>

      {/* Add Item Modal */}
      {addingToDate !== null && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) closeAddModal();
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="top-auto bottom-0 translate-y-0 md:top-1/2 md:bottom-auto md:translate-y-[-50%] w-full max-w-full sm:max-w-full md:max-w-lg md:rounded-2xl rounded-t-2xl rounded-b-none max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] md:rounded-t-2xl">
              <div>
                <DialogTitle className="text-base leading-normal font-semibold text-white">
                  {editingItem ? "Edit" : "Add to"}{" "}
                  {formatModalDayLabel(addingToDate)}
                </DialogTitle>
                {editingItem?.content_id && (
                  <p className="text-[11px] text-white/80 mt-1">
                    Update time or choose a new item below
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingItem?.content_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={saveEditingContent}
                    className="text-white hover:bg-white/15 rounded-lg"
                  >
                    Save
                  </Button>
                )}
                {editingItem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteEditingItem}
                    className="text-white/90 hover:bg-white/15 rounded-lg"
                  >
                    Delete
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={closeAddModal}
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="size-5" />
                </Button>
              </div>
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
                    addQuickNote(addingToDate);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    type="text"
                    placeholder='e.g., "Salmon", "Date night"'
                    value={quickNoteInput}
                    onChange={(e) => setQuickNoteInput(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={!quickNoteInput.trim() || addingQuickNote}
                  >
                    {addingQuickNote ? "..." : editingItem ? "Save" : "Add"}
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
                    className="max-w-[140px]"
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
                    className="flex-1"
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
              {library?.allTags && library.allTags.length > 0 && (
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <TagFilter
                    tags={library.allTags}
                    selectedTags={selectedTagIds}
                    onToggle={toggleTagSelection}
                    onClear={() => setSelectedTagIds([])}
                  />
                </div>
              )}

              {/* Suggested for this day */}
              {!editingItem && modalWeek && modalPicks.length > 0 && (
                <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background-alt)]">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Suggested for {formatModalDayLabel(addingToDate)}
                  </p>
                  <SuggestionStrip
                    dayIndex={modalDayIndex}
                    picks={modalPicks}
                    contentById={contentById}
                    weekStart={modalWeek}
                    onAdd={(contentId, dayIndex) => {
                      addSuggestionToDay(contentId, dayIndex, modalWeek);
                      closeAddModal();
                    }}
                    onDismiss={(contentId, dayIndex) =>
                      dismissSuggestion(contentId, dayIndex, modalWeek)
                    }
                    onRefresh={(dayIndex) =>
                      refreshDaySuggestions(dayIndex, modalWeek)
                    }
                    isRefreshing={
                      refreshingKey === `${modalWeek}:${modalDayIndex}`
                    }
                    emptyPool={false}
                    layout="mobile"
                  />
                </div>
              )}

              {/* Content List */}
              <div className="p-4 space-y-2">
                {getFilteredContent().map((content: ContentWithTags) => {
                  const Icon = categoryUI(content.category).icon;
                  return (
                    <button
                      key={content.id}
                      onClick={() => addToDay(content.id, addingToDate)}
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
                              <Badge
                                key={tag.id}
                                variant="accent"
                                className="text-[10px] px-1.5 py-0.5 font-normal text-[var(--foreground)]"
                              >
                                {tag.name}
                              </Badge>
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
                        className="mt-2 text-xs"
                      >
                        Clear all filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Grocery List Modal */}
      {groceryList.isOpen && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setGroceryList((s) => ({ ...s, isOpen: false }));
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] rounded-t-2xl">
              <div>
                <DialogTitle className="text-lg leading-normal font-semibold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Grocery List
                </DialogTitle>
                <p className="text-xs text-white/80">{formatWeekRange()}</p>
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
                    className="mt-4"
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
                                        <span className="text-[var(--primary)] text-xs">
                                          •
                                        </span>
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
                                          For:{" "}
                                          {item.sources
                                            .map((s) => s.title)
                                            .join(", ")}
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
                                            href={`/dashboard/${source.id}?from=planner&week=${anchorWeek}`}
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
          </DialogContent>
        </Dialog>
      )}

      {/* Item Share Modal */}
      {itemShare.isOpen && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setItemShare((s) => ({ ...s, isOpen: false }));
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-md max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] rounded-t-2xl">
              <div>
                <DialogTitle className="text-lg leading-normal font-semibold text-white">
                  Share Item
                </DialogTitle>
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

                  {library?.shareableFriends &&
                  library.shareableFriends.length > 0 ? (
                    <>
                      {library.shareableFriends.map(
                        (friend: ShareableFriend) => {
                        const isSelected = itemShare.selectedFriendIds.includes(
                          friend.id,
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
                                isSelected
                                  ? "bg-[var(--primary)]/10"
                                  : "bg-[var(--muted)]"
                              }`}
                            >
                              {friend.isFavorite ? (
                                <Star
                                  className={`w-5 h-5 ${isSelected ? "text-[var(--primary)]" : ""}`}
                                />
                              ) : (
                                <User
                                  className={`w-5 h-5 ${isSelected ? "text-[var(--primary)]" : ""}`}
                                />
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
                  <Button
                    variant="link"
                    onClick={() =>
                      setItemShare((s) => ({ ...s, showAddFriend: false }))
                    }
                    className="h-auto p-0 text-sm font-normal text-muted-foreground hover:text-foreground hover:no-underline gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to friends
                  </Button>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">
                        Name
                      </Label>
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
                      <Label className="text-sm font-medium mb-1.5 block">
                        Phone{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
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
                      className="w-full"
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
          </DialogContent>
        </Dialog>
      )}

      {/* Undo pill for AI-suggested adds */}
      {undoState && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--foreground)] text-[var(--background)] rounded-full pl-4 pr-2 py-2 flex items-center gap-3 shadow-lg">
          <span className="text-sm">
            Added <span className="font-medium">{undoState.contentTitle}</span>
          </span>
          <button
            onClick={undoLastAdd}
            className="text-sm font-semibold uppercase tracking-wide bg-[var(--background)] text-[var(--foreground)] rounded-full px-3 py-1 hover:bg-[var(--muted)]"
          >
            Undo
          </button>
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
