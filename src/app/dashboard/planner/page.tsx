"use client";

import { AddToggle } from "@/components/add-toggle";
import { filterBySearch } from "@/components/category-tabs";
import { TimeChips } from "@/components/time-chips";
import { Sheet, SheetSection } from "@/components/ui/sheet";
import { SlideOpen } from "@/components/slide-open";
import { WeekStrip } from "@/components/week-strip";
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
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Download,
  Heart,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  User,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type ElementType,
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
import {
  DraftRow,
  type SuggestionPickView,
} from "./components/SuggestionStrip";
import { WeekSection } from "./components/WeekSection";
import { getItemDateKey } from "@/lib/plan-dates";
import { contentMeta } from "@/lib/plan-item-details";
import {
  DEFAULT_PLAN_TIME,
  describeTime,
  plannedDateFor,
  shortDayLabel,
} from "@/lib/plan-time";
import {
  groceryItemKey,
  groupByAisle,
  type GroceryItem,
} from "@/lib/grocery-list";
import {
  canShareImageFiles,
  downloadImage,
  isStandaloneApp,
  renderGroceryImage,
  shareImage,
} from "./grocery-image";
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

/**
 * Whether suggestion strips are shown (PLA-42).
 *
 * localStorage rather than a user_settings column: this is a view preference,
 * the same kind as the week-start day and hidden auto-events which already live
 * there, and adding a column would mean a migration against a live table for a
 * boolean that never needs to follow anyone across devices.
 *
 * Default on. Someone who has never touched this should still see the feature.
 */
const SUGGESTIONS_HIDDEN_KEY = "planner-suggestions-hidden";

function readSuggestionsHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SUGGESTIONS_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

interface GroceryListState {
  isOpen: boolean;
  items: GroceryItem[];
  tips: string[];
  expandedIngredient: string | null;
  /** Pantry staples are hidden until asked for, in the list and the image. */
  showStaples: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /**
   * A failure from Share, Download or saving a check-off.
   *
   * Separate from `error`, which replaces the whole list view — using it here
   * would delete the list the user is looking at to tell them a screenshot
   * failed. Save failing must not cost you the thing you were saving.
   */
  saveError: string | null;
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

type PickTab = "ideas" | "recent" | "all";

const PICK_TABS: { id: PickTab; label: string }[] = [
  { id: "ideas", label: "Ideas" },
  { id: "recent", label: "Recent" },
  { id: "all", label: "All saved" },
];

/** How many recently saved items the Recent tab lists. */
const RECENT_LIMIT = 15;

const ADD_SHEET_CATEGORIES: {
  id: ContentCategory | "all";
  label: string;
  icon: ElementType | null;
}[] = [
  { id: "all", label: "All", icon: null },
  { id: "meal", label: "Meals", icon: Utensils },
  { id: "drink", label: "Drinks", icon: Coffee },
  { id: "event", label: "Events", icon: Calendar },
  { id: "date_idea", label: "Restaurants", icon: Heart },
];

/** A saved item's photo in a sheet row, or its category icon on its tint. */
function SheetThumb({ content }: { content: Content }) {
  const ui = categoryUI(content.category);
  if (content.thumbnail_url) {
    return (
      <img
        src={content.thumbnail_url}
        alt=""
        className="size-11 shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${ui.bg}`}
    >
      <ui.icon className={`size-5 ${ui.text}`} />
    </span>
  );
}

function withoutKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function PlannerContent() {
  const searchParams = useSearchParams();

  // Week start day preference (0=Sunday, 1=Monday, etc.)
  const weekStartDay = useMemo(() => getWeekStartDay(), []);

  /**
   * The focused date is resolved during the first render, not in an effect.
   * PlannerContent sits behind a Suspense boundary (it calls
   * useSearchParams), so it never runs during the prerender — reading the URL
   * and the clock here is client-only and can't desync from server HTML.
   *
   * Deferring it to an effect meant the first committed frame had no date
   * yet. WebKit paints that commit, so on iOS the header appeared 44px
   * shorter with an empty control row and a spinner before snapping to full
   * size and scrolling to today. Chromium happened to flush the effect before
   * painting, which is why it only ever showed up on the phone.
   */
  const [initialAnchor] = useState(() => {
    const urlDate = searchParams.get("date") || searchParams.get("week");
    return urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)
      ? urlDate
      : formatDateString(new Date());
  });

  const [anchorDate, setAnchorDate] = useState<string>(initialAnchor);
  const [weeks, setWeeks] = useState<string[]>(() => {
    const week = getWeekStartForDate(
      parseDateString(initialAnchor),
      weekStartDay,
    );
    return [week, addWeeksTo(week, 1), addWeeksTo(week, 2)];
  });
  // Scrolling still waits for layout, but the day elements now exist in the
  // same commit, so the layout effect lands it before the first paint.
  const [pendingScroll, setPendingScroll] = useState<PendingScroll | null>(
    () => ({ dateKey: initialAnchor, smooth: false }),
  );
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  const [addingToDate, setAddingToDate] = useState<string | null>(null);
  // One field for the whole add-modal: it filters saved items as you type and
  // doubles as the title if you add what you typed as a quick note.
  const [entryQuery, setEntryQuery] = useState("");
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  // Read after mount, never during render: the server has no localStorage, so
  // seeding state from it directly would hydrate mismatched.
  useEffect(() => {
    setSuggestionsHidden(readSuggestionsHidden());
  }, []);

  const toggleSuggestions = () => {
    setSuggestionsHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SUGGESTIONS_HIDDEN_KEY, String(next));
      } catch {}
      return next;
    });
  };
  const [addingQuickNote, setAddingQuickNote] = useState(false);
  const [plannedTime, setPlannedTime] = useState("19:00");
  const [editingItem, setEditingItem] = useState<PlanItemWithSharing | null>(
    null,
  );
  // What this visit to the add sheet has put on the day, so each row can show
  // a check and take it back off. Content id → plan item id.
  const [addedItems, setAddedItems] = useState<Record<string, string>>({});
  const [pendingAddKey, setPendingAddKey] = useState<string | null>(null);
  // Ideas added this visit. The engine stops suggesting something once it's
  // planned, so without this an idea would vanish the moment you added it
  // instead of showing its check.
  const [addedIdeas, setAddedIdeas] = useState<SuggestionPickView[]>([]);
  // The sheet's mode: picking from the collection, or writing a note.
  const [sheetMode, setSheetMode] = useState<"pick" | "note">("pick");
  // While editing, Replace… opens the picker to swap the item.
  const [replacing, setReplacing] = useState(false);
  // The day and time controls fold into one pill until tapped.
  const [whenOpen, setWhenOpen] = useState(false);
  // null: let the sheet choose — Ideas when there are any, otherwise All.
  const [pickTab, setPickTab] = useState<PickTab | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  // Dynamic day name arrays based on user's week start preference
  const { days: DAYS, daysFull: DAYS_FULL } = useMemo(
    () => getOrderedDays(weekStartDay),
    [weekStartDay],
  );

  const {
    categoryFilter,
    setCategoryFilter,
    selectedTagIds,
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
    showStaples: false,
    loading: false,
    saving: false,
    saveError: null,
    error: null,
  });
  // Check-off saves run one after another, so a slow request can never land
  // after a newer one and undo it.
  const groceryCheckSaves = useRef<Promise<void>>(Promise.resolve());
  const [imageShareable, setImageShareable] = useState(false);
  const [standaloneApp, setStandaloneApp] = useState(false);

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
  // Briefly suppressed at mount too: the initial scroll to the focused date
  // must not be overwritten by the spy reacting to it.
  const suppressSpyUntilRef = useRef(Date.now() + 300);
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

  // The week grid (day cards, sentinels) is mounted from the first render;
  // this only gates on the session still being unknown on a cold load.
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

  const resetAdded = () => {
    setAddedItems({});
    setAddedIdeas([]);
  };

  const resetSheet = () => {
    setEntryQuery("");
    resetAdded();
    setSheetMode("pick");
    setReplacing(false);
    setWhenOpen(false);
    setPickTab(null);
  };

  const openAddModal = (dateKey: string) => {
    resetSheet();
    setPlannedTime(DEFAULT_PLAN_TIME);
    setEditingItem(null);
    setAddingToDate(dateKey);
  };

  const closeAddModal = () => {
    setAddingToDate(null);
    setEditingItem(null);
    setAddingQuickNote(false);
    resetSheet();
  };

  /**
   * The sheet's week strip moves it to another day. While adding, the checks
   * belonged to the day being left, so they go; while editing, the new day is
   * just where Save will put the item.
   */
  const changeSheetDay = (dateKey: string) => {
    setAddingToDate(dateKey);
    if (!editingItem) resetAdded();
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
    resetSheet();
    setEditingItem(item);
    setPlannedTime(getTimeInputValue(item.planned_date));
    // A note opens with its own title in the field, ready to be reworded.
    setEntryQuery(item.note_title || "");
    setAddingToDate(dateKey);
  };

  const getPlannedDateTime = (dateKey: string, timeValue: string) =>
    plannedDateFor(dateKey, timeValue);

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

  /**
   * Adding keeps the sheet open: a day is usually more than one thing, and
   * reopening the sheet for each was most of the work of planning one. In edit
   * mode a row swaps the item instead, and that does finish the job.
   */
  const addToDay = async (
    contentId: string,
    dateKey: string,
    source?: "ai_suggested",
  ) => {
    const plannedDate = getPlannedDateTime(dateKey, plannedTime);
    if (!plannedDate) return;

    if (editingItem) {
      try {
        const res = await fetch("/api/planner/item", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            contentId,
            plannedDate,
          }),
        });
        if (res.ok) revalidateDate(dateKey);
      } catch (error) {
        console.error("Failed to update item:", error);
      }
      closeAddModal();
      return;
    }

    setPendingAddKey(contentId);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          plannedDate,
          ...(source ? { source } : {}),
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { item?: { id: string } };
        const itemId = body.item?.id;
        if (itemId) {
          setAddedItems((prev) => ({ ...prev, [contentId]: itemId }));
        }
        revalidateDate(dateKey);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    } finally {
      setPendingAddKey(null);
    }
  };

  /** Take back something added from the sheet, by tapping its check. */
  const removeAddedItem = async (contentId: string, dateKey: string) => {
    const itemId = addedItems[contentId];
    if (!itemId) return;
    setPendingAddKey(contentId);
    await removeFromDay(itemId, weekOf(dateKey));
    setAddedItems((prev) => withoutKey(prev, contentId));
    setPendingAddKey(null);
  };

  /**
   * `title` overrides what is in the field, so tapping a past note adds it
   * directly rather than having to write it back into the input first.
   */
  const addQuickNote = async (dateKey: string, title?: string) => {
    const noteTitle = (title ?? entryQuery).trim();
    if (!noteTitle) return;

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
            noteTitle,
            plannedDate,
          }),
        });

        if (res.ok) {
          revalidateDate(dateKey);
          closeAddModal();
        }
        return;
      }
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteTitle,
          plannedDate,
        }),
      });

      // A note is one thing written for one day, so writing it finishes
      // the job — unlike picking, where a day is often several things.
      if (res.ok) {
        revalidateDate(dateKey);
        closeAddModal();
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
    categoryFilter !== "all" || selectedTagIds.length > 0;

  /**
   * Everything that can go on the sheet's day: saved items that aren't gifts
   * and aren't already planned that week. Something added from this sheet
   * stays, with its check, so it can be taken back off.
   */
  const getPickableContent = (): ContentWithTags[] => {
    if (!library?.availableContent) return [];

    // keepPreviousData means modalData can briefly belong to another week;
    // only trust its plan items for used-item filtering once it matches.
    const modalReady =
      !!modalData && modalData.plan?.week_start === modalWeek;
    const planItems: PlanItemWithSharing[] = modalReady
      ? modalData.plan?.items || []
      : [];
    const usedIds = new Set(
      planItems.map((i: PlanItemWithSharing) => i.content_id) || [],
    );

    return (library.availableContent as ContentWithTags[]).filter(
      (c) =>
        c.category !== "gift_idea" &&
        (!usedIds.has(c.id) || c.id in addedItems),
    );
  };

  /** The All tab: pickable items narrowed by the category and tag chips. */
  const getFilteredContent = () =>
    getPickableContent().filter((c: ContentWithTags) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;

      if (selectedTagIds.length > 0) {
        const contentTagIds = c.tags?.map((t: Tag) => t.id) || [];
        const hasMatchingTag = selectedTagIds.some((tagId) =>
          contentTagIds.includes(tagId),
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });


  /**
   * Quick notes planned before that match what is being typed (PLA-43).
   *
   * "Leftovers" and "Dinner at mum's" recur constantly and were retyped every
   * time, because this search only ever looked at saved content. Hidden with an
   * empty query — an unprompted list of every note ever written would bury the
   * saved items this modal is mostly for.
   */
  const getMatchingNotes = (): string[] => {
    const query = entryQuery.trim().toLowerCase();
    if (!query) return [];
    return (library?.recentNotes ?? [])
      .filter((note) => note.toLowerCase().includes(query))
      // Exact match is already offered by the "Add ..." button above.
      .filter((note) => note.toLowerCase() !== query)
      .slice(0, 5);
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
    // Quick notes go to the generator as-is. It guesses ingredients for the
    // ones that name a meal and skips the rest ("Iowa", "Rosh bday").
    const notes: { id: string; title: string }[] = [];

    for (const item of allItems) {
      const content = item.content;
      if (!content) {
        const title = item.note_title?.trim();
        if (title) notes.push({ id: item.id, title });
        continue;
      }

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

    const emptyList = {
      isOpen: true,
      items: [],
      tips: [],
      expandedIngredient: null,
      showStaples: false,
      saving: false,
      saveError: null,
    };

    if (recipes.length === 0 && notes.length === 0) {
      setGroceryList({
        ...emptyList,
        loading: false,
        error: "No meals found for this week.",
      });
      return;
    }

    setGroceryList({ ...emptyList, loading: true, error: null });
    setImageShareable(canShareImageFiles());
    setStandaloneApp(isStandaloneApp());

    try {
      // Let queued check-off saves land first. Otherwise this read can return
      // the list from before them, and the next tick, which sends the full
      // checked set, would untick them on the server.
      await groceryCheckSaves.current;
      const response = await fetch("/api/planner/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipes, notes, weekStart: anchorWeek }),
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

  const toggleGroceryItem = (ingredient: string) => {
    const key = groceryItemKey(ingredient);
    const items = groceryList.items.map((item) =>
      groceryItemKey(item.ingredient) === key
        ? { ...item, checked: !item.checked }
        : item,
    );
    setGroceryList((s) => ({ ...s, items, saveError: null }));

    const body = JSON.stringify({
      weekStart: anchorWeek,
      checked: items.filter((i) => i.checked).map((i) => i.ingredient),
    });
    groceryCheckSaves.current = groceryCheckSaves.current
      .then(async () => {
        const response = await fetch("/api/planner/grocery-list", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      })
      .catch((error) => {
        console.error("Failed to save grocery check-off:", error);
        setGroceryList((s) => ({
          ...s,
          saveError: "Couldn't save that check-off.",
        }));
      });
  };

  const groceryGroups = groupByAisle(groceryList.items, {
    showStaples: groceryList.showStaples,
  });
  const stapleCount = groceryList.items.filter((i) => i.staple).length;
  const groceryExportDisabled =
    groceryList.saving ||
    groceryList.loading ||
    groceryGroups.every((g) => g.items.every((i) => i.checked));

  // The image is what's still to buy: the list as shown, minus ticked items.
  const exportGroceryImage = async (mode: "share" | "download") => {
    setGroceryList((s) => ({ ...s, saving: true, saveError: null }));

    try {
      const groups = groceryGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => !i.checked) }))
        .filter((g) => g.items.length > 0);
      const file = await renderGroceryImage(
        groups,
        formatWeekRange(),
        `grocery-list-${anchorWeek}.png`,
      );

      if (mode === "share") {
        try {
          await shareImage(file);
          return;
        } catch (shareError) {
          // A home-screen app on iOS has no download UI, so falling back to
          // a download there would fail silently. Say it failed instead.
          if (standaloneApp) throw shareError;
          // Elsewhere an unexpected share failure still gets the person their image.
          console.error("Share failed, downloading instead:", shareError);
        }
      }
      downloadImage(file);
    } catch (error) {
      console.error("Failed to save screenshot:", error);
      setGroceryList((s) => ({
        ...s,
        saveError: "Couldn't save the list. Try again.",
      }));
    } finally {
      setGroceryList((s) => ({ ...s, saving: false }));
    }
  };

  const hasGroceryMeals = useMemo(() => {
    if (!data?.plan?.items && !data?.sharedItems) return false;
    const allItems: (PlanItemWithSharing | SharedPlanItem)[] = [
      ...(data.plan?.items || []),
      ...(data.sharedItems || []),
    ];
    return allItems.some(
      (item: PlanItemWithSharing | SharedPlanItem) =>
        item.content?.category === "meal" ||
        item.content?.category === "drink" ||
        (!item.content && !!item.note_title?.trim()),
    );
  }, [data?.plan?.items, data?.sharedItems]);

  const todayKey = formatDateString(new Date());

  // The add/edit sheet's derived state.
  const sheetQuery = entryQuery.trim();
  // Editing shows the item and when it happens; Replace… swaps to the picker.
  const sheetEditing = !!editingItem && !replacing;
  const sheetEditingNote = !!editingItem && !editingItem.content_id;
  const sheetPickable = addingToDate !== null ? getPickableContent() : [];
  const sheetIdeas: SuggestionPickView[] = [
    ...addedIdeas,
    ...modalPicks.filter(
      (pick) => !addedIdeas.some((added) => added.contentId === pick.contentId),
    ),
  ].filter((pick) => contentById.has(pick.contentId));
  const sheetTab: PickTab =
    pickTab ?? (sheetIdeas.length > 0 && !replacing ? "ideas" : "all");
  const sheetRows: ContentWithTags[] = sheetQuery
    ? filterBySearch(sheetPickable, sheetQuery)
    : sheetTab === "recent"
      ? [...sheetPickable]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, RECENT_LIMIT)
      : sheetTab === "all"
        ? getFilteredContent()
        : [];
  const sheetNoteChips = sheetMode === "note" ? getMatchingNotes() : [];
  // Ideas are for filling a day, not for swapping an item already on it.
  const sheetTabs = PICK_TABS.filter(
    (tab) => !(replacing && tab.id === "ideas"),
  );
  const sheetAddedCount = Object.keys(addedItems).length;
  const sheetWeekday = addingToDate
    ? parseDateString(addingToDate).toLocaleDateString("en-US", {
        weekday: "long",
      })
    : "";

  /** Put an idea on the day — or take it back off if it's already there. */
  const toggleIdea = (pick: SuggestionPickView) => {
    if (!addingToDate) return;
    if (pick.contentId in addedItems) {
      removeAddedItem(pick.contentId, addingToDate);
      return;
    }
    setAddedIdeas((prev) =>
      prev.some((p) => p.contentId === pick.contentId) ? prev : [...prev, pick],
    );
    addToDay(pick.contentId, addingToDate, "ai_suggested");
  };

  /** One row of the picker: photo, title, the card's detail line, and +. */
  const renderPickRow = (content: ContentWithTags, index: number) => {
    const added = content.id in addedItems;
    return (
      <li
        key={content.id}
        className={`sheet-row-in flex items-center gap-3 px-4 py-2.5 transition-colors duration-300 ${
          added ? "bg-[var(--meal-bg)]/60" : ""
        }`}
        style={{ "--i": index } as React.CSSProperties}
      >
        <SheetThumb content={content} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[15px] font-medium">
            {content.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {contentMeta(content) ?? categoryUI(content.category).label}
          </p>
        </div>
        <AddToggle
          added={added}
          pending={pendingAddKey === content.id}
          label={content.title}
          onToggle={() =>
            added && addingToDate
              ? removeAddedItem(content.id, addingToDate)
              : addingToDate && addToDay(content.id, addingToDate)
          }
        />
      </li>
    );
  };

  // The header renders no matter what. Swapping the whole page for a spinner
  // until the focused date resolved meant the header tore down and slid back
  // in every single time you tapped the Plan tab.
  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div
        ref={headerRef}
        className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-20"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left slot. On mobile this was an empty w-16 spacer holding the
              title centred against the cart button; the toggle now occupies it
              rather than sitting on a row of its own below the filters. */}
          <div className="flex items-center gap-1 w-16 md:w-auto">
            <Link href="/dashboard" className="hidden md:inline-flex">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSuggestions}
              aria-pressed={!suggestionsHidden}
              aria-label={
                suggestionsHidden ? "Show suggestions" : "Hide suggestions"
              }
              title={
                suggestionsHidden ? "Show suggestions" : "Hide suggestions"
              }
            >
              {/* The same sparkle that marks every idea, so the toggle
                  says what it turns off. Struck through when off. */}
              <span className="relative inline-flex">
                <Sparkles
                  className={`w-4 h-4 ${
                    suggestionsHidden
                      ? "text-muted-foreground"
                      : "text-[var(--accent)]"
                  }`}
                />
                {suggestionsHidden && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-muted-foreground"
                  />
                )}
              </span>
            </Button>
          </div>
          <h1 className="heading-2 text-xl md:text-2xl">Planner</h1>
          <Button
            variant="ghost"
            onClick={generateGroceryList}
            disabled={!hasGroceryMeals}
            title={
              hasGroceryMeals
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
          {!contentReady && (
            <div className="py-16 text-center">
              <div className="loading-spinner mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                Loading your planner...
              </p>
            </div>
          )}
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
              suggestionsHidden={suggestionsHidden}
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

      {/* Add / edit sheet. Three focused views instead of one that did
          everything: the picker (the day's +), a note, and edit. */}
      {addingToDate !== null && (
        <Sheet
          open
          onOpenChange={(o) => {
            if (!o) closeAddModal();
          }}
          // The picker keeps one height while you type and switch tabs.
          fullHeight={!sheetEditing && sheetMode === "pick"}
          title={
            sheetEditing
              ? "Edit plan"
              : sheetMode === "note"
                ? `Note for ${shortDayLabel(addingToDate)}`
                : `Add to ${shortDayLabel(addingToDate)}`
          }
          header={
            sheetEditing ? undefined : (
              <div className="flex items-center gap-2">
                {/* When, folded into one pill: the day you tapped and the
                    usual time. It opens only to change them. */}
                <button
                  type="button"
                  onClick={() => setWhenOpen((open) => !open)}
                  aria-expanded={whenOpen}
                  className="surface-raised inline-flex min-w-0 items-center gap-1.5 rounded-full py-1.5 pl-3 pr-2.5 text-[15px] font-semibold transition-transform active:translate-y-px"
                >
                  <CalendarDays className="size-4 shrink-0 text-[var(--primary)]" />
                  <span className="truncate">
                    {shortDayLabel(addingToDate)} · {describeTime(plannedTime)}
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      whenOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <span className="flex-1" />
                {!replacing &&
                  (sheetMode === "pick" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode("note");
                        setEntryQuery("");
                      }}
                      className="surface-raised inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-transform active:translate-y-px"
                    >
                      <PenLine className="size-3.5 text-[var(--primary)]" />
                      Note
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode("pick");
                        setEntryQuery("");
                      }}
                      className="surface-raised inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-transform active:translate-y-px"
                    >
                      <Search className="size-3.5 text-[var(--primary)]" />
                      Collection
                    </button>
                  ))}
              </div>
            )
          }
          top={
            <>
              {sheetEditing && editingItem?.content && (
                <div className="surface-inset flex items-center gap-3 rounded-2xl p-2.5">
                  <SheetThumb content={editingItem.content} />
                  <p className="line-clamp-2 min-w-0 text-[15px] font-medium">
                    {editingItem.content.title}
                  </p>
                </div>
              )}
              {sheetEditing && sheetEditingNote && (
                <Input
                  value={entryQuery}
                  onChange={(e) => setEntryQuery(e.target.value)}
                  aria-label="Note"
                  className="h-11 text-base"
                />
              )}
              {sheetEditing ? (
                <>
                  <WeekStrip
                    value={addingToDate}
                    onChange={changeSheetDay}
                    weekStartDay={weekStartDay}
                  />
                  <TimeChips value={plannedTime} onChange={setPlannedTime} />
                </>
              ) : (
                // The pill's panel slides open rather than appearing.
                <SlideOpen open={whenOpen} className="space-y-3 px-px pb-1">
                  <WeekStrip
                    value={addingToDate}
                    onChange={changeSheetDay}
                    weekStartDay={weekStartDay}
                  />
                  <TimeChips value={plannedTime} onChange={setPlannedTime} />
                </SlideOpen>
              )}
              {!sheetEditing && sheetMode === "note" && (
                <form
                  className="relative"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addQuickNote(addingToDate);
                  }}
                >
                  <PenLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={entryQuery}
                    onChange={(e) => setEntryQuery(e.target.value)}
                    placeholder="Leftovers, dinner at Mom’s…"
                    aria-label="Note"
                    enterKeyHint="done"
                    autoFocus
                    className="h-11 pl-10 pr-12 text-base"
                  />
                  <button
                    type="submit"
                    disabled={!sheetQuery || addingQuickNote}
                    aria-label="Add note"
                    className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-transform active:scale-95 disabled:opacity-40"
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </button>
                </form>
              )}
              {!sheetEditing && sheetMode === "pick" && (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={entryQuery}
                      onChange={(e) => setEntryQuery(e.target.value)}
                      placeholder="Search your collection"
                      aria-label="Search your collection"
                      enterKeyHint="search"
                      className="h-11 pl-10 pr-10 text-base [&::-webkit-search-cancel-button]:hidden"
                    />
                    {entryQuery && (
                      <button
                        type="button"
                        onClick={() => setEntryQuery("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)]"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  {!sheetQuery && (
                    <div
                      role="tablist"
                      aria-label="Show"
                      className="surface-inset relative grid gap-1 rounded-full p-1"
                      style={{
                        gridTemplateColumns: `repeat(${sheetTabs.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {/* One highlight that slides to the chosen tab, rather
                          than each tab lighting up on its own. */}
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-1 rounded-full bg-[var(--card)] shadow-[0_1px_3px_rgba(45,52,54,0.15)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                        style={{
                          width: `calc((100% - 0.5rem - ${sheetTabs.length - 1} * 0.25rem) / ${sheetTabs.length})`,
                          transform: `translateX(calc(${Math.max(
                            0,
                            sheetTabs.findIndex((tab) => tab.id === sheetTab),
                          )} * (100% + 0.25rem)))`,
                        }}
                      />
                      {sheetTabs.map((tab) => {
                        const selected = sheetTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setPickTab(tab.id)}
                            className={`relative inline-flex items-center justify-center gap-1 rounded-full py-1.5 text-[13px] font-medium transition-colors duration-300 ${
                              selected
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {tab.id === "ideas" && (
                              <Sparkles className="size-3.5 text-[var(--accent)]" />
                            )}
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          }
          footer={
            sheetEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={deleteEditingItem}
                  className="text-destructive hover:bg-red-50 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
                {!sheetEditingNote && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReplacing(true);
                      setPickTab(null);
                      setEntryQuery("");
                    }}
                    className="surface-raised rounded-full"
                  >
                    Replace…
                  </Button>
                )}
                <Button
                  className="flex-1"
                  disabled={addingQuickNote || (sheetEditingNote && !sheetQuery)}
                  onClick={
                    sheetEditingNote
                      ? () => addQuickNote(addingToDate)
                      : saveEditingContent
                  }
                >
                  Save
                </Button>
              </div>
            ) : sheetMode === "note" ? undefined : replacing ? (
              <Button
                variant="ghost"
                className="surface-raised w-full rounded-full"
                onClick={() => {
                  setReplacing(false);
                  setEntryQuery("");
                }}
              >
                Keep {editingItem?.content?.title ?? "it"}
              </Button>
            ) : (
              <Button className="w-full" onClick={closeAddModal}>
                {sheetAddedCount > 0 ? (
                  <>
                    Done ·{" "}
                    <span key={sheetAddedCount} className="count-bump">
                      {sheetAddedCount}
                    </span>{" "}
                    added
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            )
          }
        >
          {sheetEditing ? null : sheetMode === "note" ? (
            sheetNoteChips.length > 0 ? (
              <SheetSection label="Used before">
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  {sheetNoteChips.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => addQuickNote(addingToDate, note)}
                      disabled={addingQuickNote}
                      className="surface-raised inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium active:translate-y-px disabled:opacity-60"
                    >
                      <Plus className="size-3.5 text-[var(--primary)]" />
                      {note}
                    </button>
                  ))}
                </div>
              </SheetSection>
            ) : null
          ) : sheetQuery ? (
            <>
              <SheetSection
                label="Results"
                action={
                  <span className="text-xs text-muted-foreground">
                    {sheetRows.length}
                  </span>
                }
              >
                <ul className="divide-y divide-[var(--border)]">
                  {sheetRows.map(renderPickRow)}
                </ul>
              </SheetSection>
              {/* Not in the collection: it can still go on the day, as a
                  note — in the note sheet, with what was typed. */}
              {!replacing && (
                <button
                  type="button"
                  onClick={() => setSheetMode("note")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--background)]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-light)]">
                    <PenLine className="size-5 text-[var(--primary)]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[15px] font-medium">
                      Add &ldquo;{sheetQuery}&rdquo; as a note
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {sheetRows.length === 0
                        ? "Nothing saved matches"
                        : "No saved item needed"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )}
            </>
          ) : sheetTab === "ideas" ? (
            <SheetSection
              label={`Ideas for ${sheetWeekday}`}
              action={
                sheetIdeas.some((pick) => !(pick.contentId in addedItems)) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = sheetIdeas.find(
                        (pick) => !(pick.contentId in addedItems),
                      );
                      if (next) toggleIdea(next);
                    }}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--primary)]"
                  >
                    <Sparkles className="size-3.5" />
                    Surprise me
                  </button>
                ) : undefined
              }
            >
              <div className="space-y-2 px-4 pb-4">
                {sheetIdeas.map((pick, index) => {
                  const content = contentById.get(pick.contentId);
                  if (!content) return null;
                  return (
                    <DraftRow
                      key={pick.contentId}
                      className="sheet-row-in"
                      style={{ "--i": index } as React.CSSProperties}
                      content={content}
                      why={pick.why}
                      added={pick.contentId in addedItems}
                      pending={pendingAddKey === pick.contentId}
                      onAdd={() => toggleIdea(pick)}
                      onSwap={
                        modalWeek
                          ? () =>
                              dismissSuggestion(
                                pick.contentId,
                                modalDayIndex,
                                modalWeek,
                              )
                          : undefined
                      }
                    />
                  );
                })}
                {sheetIdeas.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <p>No ideas for this day right now.</p>
                    {modalWeek && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          refreshDaySuggestions(modalDayIndex, modalWeek)
                        }
                        disabled={
                          refreshingKey === `${modalWeek}:${modalDayIndex}`
                        }
                        className="mt-2 text-[var(--primary)]"
                      >
                        <RefreshCw
                          className={`size-3.5 ${
                            refreshingKey === `${modalWeek}:${modalDayIndex}`
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                        Find more
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </SheetSection>
          ) : (
            <>
              {sheetTab === "all" && (
                // Categories and tags in one scrolling row. The padding
                // lives inside the scroller, which clips vertically too.
                <div className="sticky top-0 z-10 bg-[var(--card)]">
                  <div className="overflow-x-auto hide-scrollbar">
                    <div className="flex w-max items-center gap-2 px-4 pt-2.5 pb-3">
                      {ADD_SHEET_CATEGORIES.map((cat) => {
                        const active = categoryFilter === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategoryFilter(cat.id)}
                            aria-pressed={active}
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all active:translate-y-px ${
                              active
                                ? "bg-foreground text-background"
                                : "surface-raised"
                            }`}
                          >
                            {cat.icon && <cat.icon className="size-3.5" />}
                            {cat.label}
                          </button>
                        );
                      })}
                      {(library?.allTags?.length ?? 0) > 0 && (
                        <span
                          aria-hidden
                          className="mx-1 h-5 w-px bg-[var(--border)]"
                        />
                      )}
                      {library?.allTags?.map((tag: Tag) => {
                        const active = selectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTagSelection(tag.id)}
                            aria-pressed={active}
                            className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[13px] font-medium transition-all active:translate-y-px ${
                              active
                                ? "bg-foreground text-background"
                                : "surface-raised"
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="inline-flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <SheetSection
                label={
                  replacing
                    ? "Swap it for"
                    : sheetTab === "recent"
                      ? "Recently saved"
                      : "Your collection"
                }
                className={sheetTab === "all" ? "pt-0" : undefined}
                action={
                  <span className="text-xs text-muted-foreground">
                    {sheetRows.length}
                  </span>
                }
              >
                <ul key={sheetTab} className="divide-y divide-[var(--border)]">
                  {sheetRows.map(renderPickRow)}
                </ul>
                {sheetRows.length === 0 && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium">Nothing to add here</p>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="mt-2 text-xs"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </SheetSection>
              <div className="h-4" />
            </>
          )}
        </Sheet>
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
                {imageShareable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportGroceryImage("share")}
                    disabled={groceryExportDisabled}
                    className="text-white hover:bg-white/10 rounded-lg"
                  >
                    <Share2 className="w-4 h-4 mr-1" />
                    {groceryList.saving ? "..." : "Share"}
                  </Button>
                )}
                {/* A home-screen app on iOS has no download UI, so a
                    download button there would do nothing. */}
                {!(imageShareable && standaloneApp) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportGroceryImage("download")}
                    disabled={groceryExportDisabled}
                    className="text-white hover:bg-white/10 rounded-lg"
                    aria-label="Download image"
                    title="Download image"
                  >
                    <Download className="w-4 h-4" />
                    {!imageShareable && (
                      <span className="ml-1">
                        {groceryList.saving ? "..." : "Save"}
                      </span>
                    )}
                  </Button>
                )}
                {/* A save that fails must say so. Until now the catch only
                    reached the console, so a silent no-op was indistinguishable
                    from a save that worked. */}
                {groceryList.saveError && (
                  <span
                    role="status"
                    className="self-center text-[11px] text-white/90 max-w-[9rem] leading-tight"
                  >
                    {groceryList.saveError}
                  </span>
                )}
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
                <div className="p-4">
                  {groceryList.items.length > 0 ? (
                    <>
                      {(stapleCount > 0 ||
                        groceryList.items.some((i) => i.estimated)) && (
                        <div className="flex items-center justify-between gap-2 mb-4 text-xs text-muted-foreground">
                          <span>
                            {groceryList.items.some((i) => i.estimated) &&
                              "Est. = guessed from a quick note"}
                          </span>
                          {stapleCount > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              aria-pressed={groceryList.showStaples}
                              onClick={() =>
                                setGroceryList((s) => ({
                                  ...s,
                                  showStaples: !s.showStaples,
                                }))
                              }
                            >
                              {groceryList.showStaples
                                ? "Hide pantry staples"
                                : `Show pantry staples (${stapleCount})`}
                            </Button>
                          )}
                        </div>
                      )}
                      {groceryGroups.map(({ aisle, items }) => (
                        <div key={aisle} className="mb-5">
                          <h4 className="font-semibold text-sm text-[var(--primary)] mb-2 pb-1 border-b border-[var(--border)]">
                            {aisle}
                          </h4>
                          <ul className="space-y-1">
                            {items.map((item) => (
                              <li key={item.ingredient}>
                                <div className="flex items-start gap-1 -mx-2">
                                  <button
                                    role="checkbox"
                                    aria-checked={item.checked}
                                    aria-label={`Got ${item.ingredient}`}
                                    onClick={() =>
                                      toggleGroceryItem(item.ingredient)
                                    }
                                    className="p-2 shrink-0"
                                  >
                                    <span
                                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                        item.checked
                                          ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                                          : "border-[var(--border)]"
                                      }`}
                                    >
                                      {item.checked && (
                                        <Check className="w-3 h-3" />
                                      )}
                                    </span>
                                  </button>
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
                                    className={`flex-1 min-w-0 text-left flex items-start gap-3 hover:bg-[var(--muted)] p-2 rounded-lg transition-colors ${
                                      item.checked ? "opacity-50" : ""
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-2 flex-wrap">
                                        <span
                                          className={`font-medium text-sm ${
                                            item.checked ? "line-through" : ""
                                          }`}
                                        >
                                          {item.ingredient}
                                        </span>
                                        {item.quantity && (
                                          <span className="text-xs text-muted-foreground">
                                            ({item.quantity})
                                          </span>
                                        )}
                                        {item.estimated && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] px-1.5 py-0"
                                            title="Guessed from a quick note"
                                          >
                                            Est.
                                          </Badge>
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
                                </div>

                                {groceryList.expandedIngredient ===
                                  item.ingredient && (
                                  <div className="ml-8 mt-1 mb-2 p-3 bg-[var(--muted)] rounded-lg">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                      Used in:
                                    </p>
                                    {item.sources.map((source, sIndex) =>
                                      source.kind === "note" ? (
                                        <p
                                          key={sIndex}
                                          className="text-sm text-muted-foreground py-0.5"
                                        >
                                          → {source.title} (quick note)
                                        </p>
                                      ) : (
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
                                      ),
                                    )}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

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
