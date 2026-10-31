"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlanner,
  type PlanItemWithSharing,
} from "@/hooks/usePlanner";
import type { Content, SharedPlanItem, Tag } from "@/lib/supabase";
import { formatDateString, parseDateString } from "@/lib/date-utils";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Hand,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { type ElementType, useMemo, useState } from "react";
import { categoryUI } from "@/lib/categories";
import { TypeChip } from "@/components/type-chip";
import { SlideOpen } from "@/components/slide-open";
import { PlanItemDetails } from "./PlanItemDetails";
import { SuggestionStrip } from "./SuggestionStrip";
import { WeekPlantScore } from "./WeekPlantScore";
import {
  formatItemTime,
  getItemDateKey,
  shouldShowSuggestions,
} from "@/lib/plan-dates";
import { summarizeWeekPlants } from "@/lib/week-plants";
import { travelDestination } from "@/lib/attributes";
import { Plane } from "lucide-react";

type ContentWithTags = Content & { tags?: Tag[] };

type DisplayItem = (PlanItemWithSharing | SharedPlanItem) & {
  isSharedWithMe?: boolean;
};

export interface WeekSectionProps {
  weekStart: string;
  enabled: boolean;
  days: string[];
  daysFull: string[];
  contentById: Map<string, ContentWithTags>;
  highlightDate: string | null;
  /** Dismissed suggestion keys, `${weekStart}:${dayIndex}:${contentId}` */
  dismissedSuggestions: Set<string>;
  /** User turned suggestions off for the whole planner (PLA-42). */
  suggestionsHidden?: boolean;
  /** `${weekStart}:${dayIndex}` of the day whose suggestions are refreshing */
  refreshingKey: string | null;
  registerDayElement: (dateKey: string, el: HTMLElement | null) => void;
  onOpenAdd: (dateKey: string) => void;
  onOpenEdit: (item: PlanItemWithSharing, dateKey: string) => void;
  onOpenShare: (item: PlanItemWithSharing) => void;
  onLeaveShared: (itemId: string, weekStart: string) => void;
  onShareAutoEvent: (item: PlanItemWithSharing, weekStart: string) => void;
  onAddSuggestion: (
    contentId: string,
    dayIndex: number,
    weekStart: string,
  ) => void;
  onDismissSuggestion: (
    contentId: string,
    dayIndex: number,
    weekStart: string,
  ) => void;
  onRefreshSuggestions: (dayIndex: number, weekStart: string) => void;
}

function getHiddenAutoEvents(weekStart: string): Set<string> {
  try {
    const stored = localStorage.getItem(`hidden-auto-events-${weekStart}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Makes a card's summary expand on tap, the way CardLink makes a content card
 * navigate: a button stretched over the region rather than wrapped around it,
 * because the card's Share/Edit buttons sit inside the same box and a button
 * can't contain buttons. Those lift above it with z-10.
 */
function ExpandToggle({
  expanded,
  label,
  onToggle,
  hidden = false,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  /**
   * A second tap target for the same card — the row the chevron sits in.
   * Kept out of the accessibility tree and the tab order so a screen reader
   * meets one toggle per card, not two.
   */
  hidden?: boolean;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={onToggle}
      className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    />
  );
}

/** One of a card's own buttons — Share, Edit, Leave, Hide. */
interface CardAction {
  key: string;
  icon: ElementType;
  title: string;
  /** Shown beside the icon; icon-only buttons are named by `title`. */
  label?: string;
  onClick: () => void;
}

/**
 * The row at the foot of a mobile card: its own buttons — raised, and lifted
 * above the stretched toggle — then the chevron that says the card opens.
 * `expanded` is null for a card with nothing to open.
 */
function CardActionRow({
  actions,
  expanded,
}: {
  actions: CardAction[];
  expanded: boolean | null;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <span className="relative z-10 flex items-center gap-1.5">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            title={action.title}
            aria-label={action.label ? undefined : action.title}
            className={`surface-raised flex h-7 items-center gap-1 rounded-full text-[11px] font-semibold transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              action.label ? "px-2.5" : "w-7 justify-center"
            }`}
          >
            <action.icon className="size-3.5" />
            {action.label}
          </button>
        ))}
      </span>
      {expanded !== null && <ExpandChevron expanded={expanded} />}
    </div>
  );
}

function ExpandChevron({
  expanded,
  className = "w-4 h-4",
}: {
  expanded: boolean;
  className?: string;
}) {
  return (
    <ChevronDown
      aria-hidden
      className={`${className} mt-0.5 shrink-0 text-muted-foreground transition-transform ${
        expanded ? "rotate-180" : ""
      }`}
    />
  );
}

export function WeekSection({
  weekStart,
  enabled,
  days,
  daysFull,
  contentById,
  highlightDate,
  dismissedSuggestions,
  suggestionsHidden = false,
  refreshingKey,
  registerDayElement,
  onOpenAdd,
  onOpenEdit,
  onOpenShare,
  onLeaveShared,
  onShareAutoEvent,
  onAddSuggestion,
  onDismissSuggestion,
  onRefreshSuggestions,
}: WeekSectionProps) {
  const { data } = usePlanner(weekStart, { enabled });

  // Lazy init is enough: WeekSection is keyed by weekStart, so a week
  // change always remounts with a fresh read from localStorage.
  const [hiddenAutoEvents, setHiddenAutoEvents] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : getHiddenAutoEvents(weekStart),
  );

  const hideAutoEvent = (contentId: string) => {
    setHiddenAutoEvents((prev) => {
      const next = new Set(prev);
      next.add(contentId);
      try {
        localStorage.setItem(
          `hidden-auto-events-${weekStart}`,
          JSON.stringify([...next]),
        );
      } catch {}
      return next;
    });
  };

  // Item ids, not per-layout: only one of the mobile and desktop trees is
  // ever visible, and a card opened on one should stay open across a resize.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const todayKey = formatDateString(new Date());

  const dayInfos = useMemo(() => {
    const start = parseDateString(weekStart);
    return days.map((_, dayIndex) => {
      const date = new Date(start);
      date.setDate(date.getDate() + dayIndex);
      return {
        dayIndex,
        dateKey: formatDateString(date),
        dayOfMonth: date.getDate(),
        monthShort: date.toLocaleDateString("en-US", { month: "short" }),
      };
    });
  }, [weekStart, days]);

  const isCurrentWeek = dayInfos.some((d) => d.dateKey === todayKey);

  const weekRangeLabel = useMemo(() => {
    const start = parseDateString(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const yearSuffix =
      end.getFullYear() !== new Date().getFullYear()
        ? `, ${end.getFullYear()}`
        : "";
    return `${fmt(start)} - ${fmt(end)}${yearSuffix}`;
  }, [weekStart]);

  const suggestions = data?.suggestions ?? {};
  const suggestionsMeta = data?.suggestionsMeta ?? {
    enabled: false,
    emptyPool: false,
    poolSize: 0,
  };

  const filterPicksForDay = (dayIndex: number) => {
    const list = suggestions[dayIndex] ?? [];
    return list.filter(
      (p) =>
        !dismissedSuggestions.has(`${weekStart}:${dayIndex}:${p.contentId}`),
    );
  };

  const itemsByDay = useMemo(() => {
    const planItems: PlanItemWithSharing[] = (data?.plan?.items || []).filter(
      (item) =>
        !item.is_auto_event || !hiddenAutoEvents.has(item.content_id || ""),
    );
    const sharedItemsList: SharedPlanItem[] = data?.sharedItems || [];
    const byDay: Record<number, DisplayItem[]> = {};
    for (const { dayIndex, dateKey } of dayInfos) {
      const ownItems: DisplayItem[] = planItems
        .filter((item) => getItemDateKey(item) === dateKey)
        .map((item) => ({ ...item, isSharedWithMe: false }));
      const sharedItems: DisplayItem[] = sharedItemsList
        .filter((item) => getItemDateKey(item) === dateKey)
        .map((item) => ({ ...item, isSharedWithMe: true }));
      byDay[dayIndex] = [...ownItems, ...sharedItems];
    }
    return byDay;
  }, [data?.plan?.items, data?.sharedItems, hiddenAutoEvents, dayInfos]);

  // Where each day is, when a travel item says so. First one wins: two trips
  // on one day is a connection, and naming the origin would be wrong.
  const destinationByDay = useMemo(() => {
    const out: Record<number, string> = {};
    for (const { dayIndex } of dayInfos) {
      for (const item of itemsByDay[dayIndex] ?? []) {
        if (item.content?.category !== "travel") continue;
        const place = travelDestination(
          item.content.data as Record<string, unknown>,
        );
        if (place) {
          out[dayIndex] = place;
          break;
        }
      }
    }
    return out;
  }, [dayInfos, itemsByDay]);

  const sharedCount = data?.sharedItems?.length ?? 0;
  const loading = !data;

  // Day order matters: summarizeWeekPlants credits each plant to the first
  // meal that brought it, so it has to see the week the way the calendar
  // reads it rather than the order the two queries happened to return.
  const plantSummary = useMemo(
    () =>
      summarizeWeekPlants(
        dayInfos.flatMap(({ dayIndex }) => itemsByDay[dayIndex] ?? []),
      ),
    [dayInfos, itemsByDay],
  );
  // A week with no meals in it has nothing to score, and a zero would read as
  // a bad week rather than an empty one.
  const showPlantScore =
    !loading && (plantSummary.count > 0 || plantSummary.unscoredMeals > 0);

  return (
    <section className="mb-8 md:mb-3" data-week={weekStart}>
      {/* Week label (mobile only — desktop reads as a continuous calendar) */}
      <div className="mb-2 px-1 flex md:hidden items-center justify-center gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-muted-foreground">
          {weekRangeLabel}
        </h2>
        {isCurrentWeek && (
          <Badge className="bg-[var(--accent-light)] text-[var(--accent-foreground)] text-xs px-2 py-0.5">
            This Week
          </Badge>
        )}
        {sharedCount > 0 && (
          <Badge variant="date" className="text-xs px-2 py-0.5">
            <Users className="w-3 h-3" />
            {sharedCount} shared
          </Badge>
        )}
        {showPlantScore && (
          <WeekPlantScore
            summary={plantSummary}
            weekRangeLabel={weekRangeLabel}
          />
        )}
      </div>

      {/* Desktop has no week header — the calendar is meant to read as one
          continuous run of days — so the score sits flush right above its own
          row, where it labels the week without interrupting it. */}
      {showPlantScore && (
        <div className="hidden md:flex justify-end px-1 mb-1">
          <WeekPlantScore
            summary={plantSummary}
            weekRangeLabel={weekRangeLabel}
          />
        </div>
      )}

      {/* Mobile reads like a calendar's day view: rows split by hairlines,
          not a stack of floating cards. Desktop keeps its grid of cards. */}
      <div className="grid grid-cols-1 md:grid-cols-7 md:gap-3">
        {dayInfos.map(({ dayIndex, dateKey, dayOfMonth, monthShort }) => {
          const isToday = dateKey === todayKey;
          const isHighlighted = highlightDate === dateKey;
          const dayRefreshing = refreshingKey === `${weekStart}:${dayIndex}`;
          const dayPicks = filterPicksForDay(dayIndex);
          // The engine owns the "is this day full?" rule — a day holding one
          // item still gets picks. The client just shows what it was sent.
          const showSuggestions = shouldShowSuggestions(
            suggestionsHidden,
            itemsByDay[dayIndex].length,
            dayPicks.length,
          );

          return (
            <Card
              key={dateKey}
              id={`day-${dateKey}`}
              ref={(el: HTMLDivElement | null) =>
                registerDayElement(dateKey, el)
              }
              className={`max-md:rounded-none max-md:bg-transparent max-md:shadow-none md:overflow-hidden md:hover:-translate-y-1 md:hover:shadow-[var(--shadow-lg)] ${
                isToday ? "md:ring-2 md:ring-[var(--primary)]" : ""
              } ${
                isHighlighted
                  ? "md:ring-2 md:ring-[var(--accent)] max-md:bg-[var(--accent-light)]/40"
                  : ""
              }`}
            >
              {/* Mobile Layout: like the hour labels in a calendar's day
                  view — a small, light date off to the side, sitting on the
                  hairline that starts the day, with the day's cards beside
                  it. */}
              <div className="md:hidden flex">
                <div className="w-12 shrink-0 flex flex-col items-start">
                  <span
                    className={`-translate-y-1/2 text-[11px] leading-none whitespace-nowrap ${
                      isToday
                        ? "font-semibold text-[var(--primary)]"
                        : "text-muted-foreground"
                    }`}
                    aria-label={
                      isToday
                        ? `${daysFull[dayIndex]} ${dayOfMonth}, today`
                        : `${daysFull[dayIndex]} ${dayOfMonth}`
                    }
                  >
                    {days[dayIndex]} {dayOfMonth}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="mt-1 -ml-1.5 size-7 rounded-full text-muted-foreground/70 hover:bg-[var(--muted)]"
                    onClick={() => onOpenAdd(dateKey)}
                    title={`Add to ${daysFull[dayIndex]}`}
                    aria-label={`Add to ${daysFull[dayIndex]}`}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                {/* Room on the right and top for each card's thumbnail,
                    which overhangs its corner. */}
                <div className="flex-1 min-w-0 border-t border-l border-[var(--border)] pl-3 pr-3 pt-6 pb-5">
                  {destinationByDay[dayIndex] && (
                    <Badge
                      variant="travel"
                      className="mb-3 text-[10px] px-1.5 py-0.5 max-w-full"
                    >
                      <Plane className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">
                        {destinationByDay[dayIndex]}
                      </span>
                    </Badge>
                  )}

                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 rounded-xl" />
                    </div>
                  ) : (
                    // Roomier than desktop: each card's thumbnail pops out
                    // past its top edge, into the gap above.
                    <div className="space-y-4">
                      {itemsByDay[dayIndex].map((item, itemIndex) => {
                        const isShared = item.isSharedWithMe;
                        const isAutoEvent =
                          !isShared &&
                          (item as PlanItemWithSharing).is_auto_event;
                        const sharedItem = isShared
                          ? (item as SharedPlanItem)
                          : null;
                        const ownItem = !isShared
                          ? (item as PlanItemWithSharing)
                          : null;
                        const isQuickNote = !item.content_id && item.note_title;
                        const plannedTimeLabel = formatItemTime(item);
                        const isExpanded = expandedIds.has(item.id);

                        // The card's own buttons, raised in the row at its
                        // foot beside the category mark.
                        const cardActions: CardAction[] = isAutoEvent
                          ? [
                              {
                                key: "share",
                                icon: Users,
                                label: "Share",
                                title: "Share",
                                onClick: () =>
                                  onShareAutoEvent(ownItem!, weekStart),
                              },
                              {
                                key: "hide",
                                icon: X,
                                title: "Hide from plan",
                                onClick: () => hideAutoEvent(item.content_id!),
                              },
                            ]
                          : isShared
                            ? [
                                {
                                  key: "leave",
                                  icon: Hand,
                                  title: "Leave",
                                  onClick: () =>
                                    onLeaveShared(item.id, weekStart),
                                },
                              ]
                            : [
                                {
                                  key: "share",
                                  icon: Users,
                                  label: ownItem?.shared_with?.length
                                    ? String(ownItem.shared_with.length)
                                    : "Share",
                                  title: "Share",
                                  onClick: () => onOpenShare(ownItem!),
                                },
                                {
                                  key: "edit",
                                  icon: Pencil,
                                  title: "Edit",
                                  onClick: () => onOpenEdit(ownItem!, dateKey),
                                },
                              ];

                        const topRow = (
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <TypeChip
                              category={
                                isQuickNote
                                  ? "note"
                                  : item.content?.category || "other"
                              }
                              time={plannedTimeLabel}
                              className="h-7 px-2.5 text-[11px]"
                            />
                            {isShared && (
                              <span className="surface-inset rounded-full px-2.5 py-1 text-[10px] font-medium">
                                from {sharedItem?.owner_name}
                              </span>
                            )}
                          </div>
                        );

                        // Mobile cards share one header, open or closed: the
                        // top of the item page — serif title beside a square
                        // thumbnail, on the category's tint. Opening only
                        // slides the details in underneath, so the card grows
                        // rather than changing shape.
                        if (isQuickNote) {
                          // A note with no body has nothing to expand into.
                          const canExpand = !!item.notes?.trim();
                          return (
                            <div
                              key={item.id}
                              className="group bg-[var(--accent-light)] rounded-xl overflow-hidden border border-[var(--border)]"
                            >
                              <div className="relative px-4 pt-4 pb-3">
                                {canExpand && (
                                  <ExpandToggle
                                    expanded={isExpanded}
                                    label={item.note_title!}
                                    onToggle={() => toggleExpanded(item.id)}
                                  />
                                )}
                                {topRow}
                                <h3 className="heading-2">{item.note_title}</h3>
                                <CardActionRow
                                  actions={cardActions}
                                  expanded={canExpand ? isExpanded : null}
                                />
                              </div>
                              {canExpand && (
                                <SlideOpen open={isExpanded} className="bg-white">
                                  <div className="px-4 py-3">
                                    <PlanItemDetails
                                      item={item}
                                      weekStart={weekStart}
                                    />
                                  </div>
                                </SlideOpen>
                              )}
                            </div>
                          );
                        }

                        const title = item.content?.title ?? "item";

                        // Content item display (mobile)
                        return (
                          <div
                            key={item.id}
                            // The tint is the header's: the details slide in
                            // on white below it.
                            className={`group rounded-xl border border-[var(--border)] ${
                              categoryUI(item.content?.category || "other").bg
                            }`}
                          >
                            <div className="relative flex gap-3.5 px-4 pt-4 items-start">
                              <ExpandToggle
                                expanded={isExpanded}
                                label={title}
                                onToggle={() => toggleExpanded(item.id)}
                              />
                              <div className="flex-1 min-w-0">
                                {topRow}
                                <h3
                                  className={`heading-2 ${
                                    isExpanded ? "" : "line-clamp-2"
                                  }`}
                                >
                                  {title}
                                </h3>
                              </div>
                              {item.content?.thumbnail_url && (
                                // Pops out past the card's corner, tilted like
                                // a photo tucked into it — alternating so a
                                // day's stack doesn't lean one way. Taps pass
                                // through to the toggle underneath.
                                <img
                                  src={item.content.thumbnail_url}
                                  alt=""
                                  className={`relative pointer-events-none w-[92px] h-[92px] shrink-0 -mt-7 -mr-6 rounded-2xl object-cover border-[3px] border-white shadow-[var(--shadow-lg)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
                                    itemIndex % 2 === 0
                                      ? "rotate-[5deg] group-hover:rotate-[8deg]"
                                      : "-rotate-[4deg] group-hover:-rotate-[7deg]"
                                  }`}
                                />
                              )}
                            </div>
                            <div className="relative px-4 pb-3">
                              <ExpandToggle
                                expanded={isExpanded}
                                label={title}
                                onToggle={() => toggleExpanded(item.id)}
                                hidden
                              />
                              <CardActionRow
                                actions={cardActions}
                                expanded={isExpanded}
                              />
                            </div>
                            <SlideOpen
                              open={isExpanded}
                              className="bg-white rounded-b-[11px]"
                            >
                              <PlanItemDetails item={item} weekStart={weekStart} />
                              <div className="px-4 pb-4 pt-1">
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="surface-raised rounded-full px-3.5 text-[var(--primary)] hover:bg-[var(--card)] hover:text-[var(--primary)] active:translate-y-px"
                                >
                                  <Link
                                    href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                                  >
                                    Open
                                    <ArrowRight className="size-3.5" />
                                  </Link>
                                </Button>
                              </div>
                            </SlideOpen>
                          </div>
                        );
                      })}

                      {showSuggestions && (
                        <SuggestionStrip
                          dayIndex={dayIndex}
                          picks={dayPicks}
                          contentById={contentById}
                          weekStart={weekStart}
                          onAdd={(contentId, di) =>
                            onAddSuggestion(contentId, di, weekStart)
                          }
                          onDismiss={(contentId, di) =>
                            onDismissSuggestion(contentId, di, weekStart)
                          }
                          onRefresh={(di) =>
                            onRefreshSuggestions(di, weekStart)
                          }
                          isRefreshing={dayRefreshing}
                          emptyPool={suggestionsMeta.emptyPool}
                          featureEnabled={suggestionsMeta.enabled}
                          loading={loading}
                          layout="mobile"
                        />
                      )}
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
                        {String(dayOfMonth).padStart(2, "0")}
                      </span>
                      {dayOfMonth === 1 && (
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {monthShort}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      {destinationByDay[dayIndex] && (
                        <Badge
                          variant="travel"
                          className="text-[10px] px-1.5 py-0.5 min-w-0"
                          title={destinationByDay[dayIndex]}
                        >
                          <Plane className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {destinationByDay[dayIndex]}
                          </span>
                        </Badge>
                      )}
                      {isToday && (
                        <Badge className="bg-[var(--primary)] text-white text-[10px]">
                          Today
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <CardContent className="p-2 space-y-2 min-h-[160px] bg-white rounded-b-2xl">
                  {loading ? (
                    <div className="space-y-2 pt-1">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-8 rounded-lg" />
                    </div>
                  ) : (
                    <>
                      {itemsByDay[dayIndex].map((item) => {
                        const isShared = item.isSharedWithMe;
                        const isAutoEvent =
                          !isShared &&
                          (item as PlanItemWithSharing).is_auto_event;
                        const sharedItem = isShared
                          ? (item as SharedPlanItem)
                          : null;
                        const ownItem = !isShared
                          ? (item as PlanItemWithSharing)
                          : null;
                        const isQuickNote = !item.content_id && item.note_title;
                        const plannedTimeLabel = formatItemTime(item);
                        const isExpanded = expandedIds.has(item.id);

                        // Quick note (desktop)
                        if (isQuickNote) {
                          const canExpand = !!item.notes?.trim();
                          return (
                            <div
                              key={item.id}
                              className="group relative bg-[var(--accent-light)] rounded-lg overflow-hidden p-2"
                            >
                              <div className="relative flex flex-col gap-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <FileText className="w-3 h-3 text-[var(--accent)]" />
                                  {plannedTimeLabel && (
                                    <span className="surface-inset inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-[var(--foreground)]">
                                      {plannedTimeLabel}
                                    </span>
                                  )}
                                  {isShared && (
                                    <span
                                      className="surface-inset inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium text-[var(--foreground)]"
                                    >
                                      {sharedItem?.owner_name}
                                    </span>
                                  )}
                                </div>
                                <p className="flex items-start justify-between gap-0.5 text-xs font-medium">
                                  <span
                                    className={isExpanded ? "" : "line-clamp-2"}
                                  >
                                    {item.note_title}
                                  </span>
                                  {canExpand && (
                                    <ExpandChevron
                                      expanded={isExpanded}
                                      className="w-3 h-3"
                                    />
                                  )}
                                </p>
                                {canExpand && (
                                  <ExpandToggle
                                    expanded={isExpanded}
                                    label={item.note_title!}
                                    onToggle={() => toggleExpanded(item.id)}
                                  />
                                )}
                              </div>
                              {canExpand && (
                                <SlideOpen open={isExpanded}>
                                  <div className="pt-1.5">
                                    <PlanItemDetails
                                      item={item}
                                      weekStart={weekStart}
                                      compact
                                    />
                                  </div>
                                </SlideOpen>
                              )}
                              <div className="absolute top-1 right-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isShared ? (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      onLeaveShared(item.id, weekStart)
                                    }
                                    className="size-5 surface-raised rounded text-[10px] hover:bg-[var(--card)]"
                                    title="Leave"
                                  >
                                    <Hand className="size-3" />
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onOpenShare(ownItem!)}
                                      className="h-5 gap-0.5 surface-raised rounded px-1.5 text-[9px] font-semibold hover:bg-[var(--card)]"
                                      title="Share"
                                    >
                                      <Users className="size-3" />
                                      {ownItem?.shared_with?.length
                                        ? ownItem.shared_with.length
                                        : "Share"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        onOpenEdit(ownItem!, dateKey)
                                      }
                                      className="size-5 surface-raised rounded text-[10px] hover:bg-[var(--card)]"
                                      title="Edit"
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }

                        const ui = categoryUI(
                          item.content?.category || "other",
                        );
                        const Icon = ui.icon;

                        // Content item (desktop) — header tinted like the
                        // mobile card, with the category's icon as its label.
                        return (
                          <div
                            key={item.id}
                            className="group relative bg-white rounded-lg overflow-hidden border border-[var(--border)]"
                          >
                            <ExpandToggle
                              expanded={isExpanded}
                              label={item.content?.title ?? "item"}
                              onToggle={() => toggleExpanded(item.id)}
                            />
                            <div className={`flex items-center justify-between px-2 pt-2 pb-1 ${ui.bg}`}>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Icon
                                  className={`w-3 h-3 ${ui.text}`}
                                  aria-label={ui.label}
                                />
                                {plannedTimeLabel && (
                                  <span className="surface-inset inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-[var(--foreground)]">
                                    {plannedTimeLabel}
                                  </span>
                                )}
                                {isShared && (
                                  <span
                                    className="surface-inset inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium text-[var(--foreground)]"
                                  >
                                    {sharedItem?.owner_name}
                                  </span>
                                )}
                              </div>
                              <div className="relative z-10 flex gap-0.5">
                                {isAutoEvent ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onShareAutoEvent(ownItem!, weekStart);
                                      }}
                                      className="h-5 gap-0.5 surface-raised rounded px-1.5 text-[9px] font-semibold hover:bg-[var(--card)]"
                                      title="Share"
                                    >
                                      <Users className="size-3" />
                                      Share
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        hideAutoEvent(item.content_id!);
                                      }}
                                      className="size-5 surface-raised rounded text-[10px] hover:bg-[var(--card)]"
                                      title="Hide from plan"
                                    >
                                      <X className="size-3" />
                                    </Button>
                                  </>
                                ) : isShared ? (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onLeaveShared(item.id, weekStart);
                                    }}
                                    className="size-5 surface-raised rounded text-[10px] hover:bg-[var(--card)]"
                                    title="Leave"
                                  >
                                    <Hand className="size-3" />
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenShare(ownItem!);
                                      }}
                                      className="h-5 gap-0.5 surface-raised rounded px-1.5 text-[9px] font-semibold hover:bg-[var(--card)]"
                                      title="Share"
                                    >
                                      <Users className="size-3" />
                                      {ownItem?.shared_with?.length
                                        ? ownItem.shared_with.length
                                        : "Share"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenEdit(ownItem!, dateKey);
                                      }}
                                      className="size-5 surface-raised rounded text-[10px] hover:bg-[var(--card)]"
                                      title="Edit"
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {item.content?.thumbnail_url && (
                              <img
                                src={item.content.thumbnail_url}
                                alt=""
                                className="w-full h-20 object-cover"
                              />
                            )}
                            <div className={`p-2 pt-1.5 ${ui.bg}`}>
                              <p className="flex items-start justify-between gap-0.5 text-xs font-medium">
                                <span
                                  className={isExpanded ? "" : "line-clamp-2"}
                                >
                                  {item.content?.title}
                                </span>
                                <ExpandChevron
                                  expanded={isExpanded}
                                  className="w-3 h-3"
                                />
                              </p>
                            </div>
                            {/* Above the stretched toggle, so the Maps and
                                Open links inside take their own taps. */}
                            <SlideOpen open={isExpanded}>
                              <div className="relative z-10 border-t border-[var(--border)] px-2 py-2">
                                <PlanItemDetails
                                  item={item}
                                  weekStart={weekStart}
                                  compact
                                />
                              </div>
                            </SlideOpen>
                          </div>
                        );
                      })}

                      {showSuggestions && (
                        <SuggestionStrip
                          dayIndex={dayIndex}
                          picks={dayPicks}
                          contentById={contentById}
                          weekStart={weekStart}
                          onAdd={(contentId, di) =>
                            onAddSuggestion(contentId, di, weekStart)
                          }
                          onDismiss={(contentId, di) =>
                            onDismissSuggestion(contentId, di, weekStart)
                          }
                          onRefresh={(di) =>
                            onRefreshSuggestions(di, weekStart)
                          }
                          isRefreshing={dayRefreshing}
                          emptyPool={suggestionsMeta.emptyPool}
                          featureEnabled={suggestionsMeta.enabled}
                          loading={loading}
                          layout="desktop"
                        />
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs border border-dashed border-[var(--border)] rounded-lg hover:bg-[var(--muted)] text-muted-foreground"
                        onClick={() => onOpenAdd(dateKey)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
