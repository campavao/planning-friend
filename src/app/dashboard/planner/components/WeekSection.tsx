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
  FileText,
  Hand,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryUI } from "@/lib/categories";
import { SuggestionStrip } from "./SuggestionStrip";
import { WeekPlantScore } from "./WeekPlantScore";
import { formatItemTime, getItemDateKey } from "@/lib/plan-dates";
import { summarizeWeekPlants } from "@/lib/week-plants";

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

export function WeekSection({
  weekStart,
  enabled,
  days,
  daysFull,
  contentById,
  highlightDate,
  dismissedSuggestions,
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

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {dayInfos.map(({ dayIndex, dateKey, dayOfMonth, monthShort }) => {
          const isToday = dateKey === todayKey;
          const isHighlighted = highlightDate === dateKey;
          const dayRefreshing = refreshingKey === `${weekStart}:${dayIndex}`;
          const dayPicks = filterPicksForDay(dayIndex);
          // The engine owns the "is this day full?" rule — a day holding one
          // item still gets picks. The client just shows what it was sent.
          // A completely empty day always keeps the strip so it can explain
          // itself rather than rendering blank.
          const showSuggestions =
            itemsByDay[dayIndex].length === 0 || dayPicks.length > 0;

          return (
            <Card
              key={dateKey}
              id={`day-${dateKey}`}
              ref={(el: HTMLDivElement | null) =>
                registerDayElement(dateKey, el)
              }
              className={`overflow-hidden hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] ${
                isToday ? "ring-2 ring-[var(--primary)]" : ""
              } ${isHighlighted ? "ring-2 ring-[var(--accent)]" : ""}`}
            >
              {/* Mobile Layout */}
              <div className="md:hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-[var(--primary)]">
                        {String(dayOfMonth).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium">
                        {daysFull[dayIndex]}
                      </span>
                      {isToday && (
                        <Badge className="bg-[var(--primary)] text-white text-[10px]">
                          Today
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs rounded-lg hover:bg-[var(--muted)]"
                      onClick={() => onOpenAdd(dateKey)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 rounded-xl" />
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                                    <Badge className="bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                                      {plannedTimeLabel}
                                    </Badge>
                                  )}
                                  {isShared && (
                                    <Badge
                                      variant="muted"
                                      className="px-1.5 py-0.5 text-[10px] font-medium"
                                    >
                                      from {sharedItem?.owner_name}
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium text-sm">
                                  {item.note_title}
                                </p>
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1">
                                {isShared ? (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      onLeaveShared(item.id, weekStart)
                                    }
                                    className="size-7 rounded-lg bg-white text-xs shadow-sm"
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
                                      className="h-7 gap-1 rounded-lg bg-white px-2 text-[10px] font-semibold shadow-sm"
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
                                      className="size-7 rounded-lg bg-white text-xs shadow-sm"
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

                        const Icon = categoryUI(
                          item.content?.category || "other",
                        ).icon;

                        // Content item display (mobile)
                        return (
                          <div
                            key={item.id}
                            className="group relative bg-white rounded-xl overflow-hidden border border-[var(--border)] flex items-stretch min-h-20"
                          >
                            {item.content?.thumbnail_url && (
                              <div className="w-20 shrink-0 relative overflow-hidden">
                                <img
                                  src={item.content.thumbnail_url}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover rounded-l-xl"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 p-2 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {item.content?.category?.replace("_", " ")}
                                  </span>
                                  {plannedTimeLabel && (
                                    <Badge
                                      variant="accent"
                                      className="px-2 py-0.5 text-[10px] font-semibold"
                                    >
                                      {plannedTimeLabel}
                                    </Badge>
                                  )}
                                  {isShared && (
                                    <Badge
                                      variant="muted"
                                      className="px-1.5 py-0.5 text-[10px] font-medium"
                                    >
                                      from {sharedItem?.owner_name}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isAutoEvent ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          onShareAutoEvent(ownItem!, weekStart)
                                        }
                                        className="h-7 gap-1 rounded-lg bg-white px-2 text-[10px] font-semibold shadow-sm"
                                        title="Share"
                                      >
                                        <Users className="size-3" />
                                        Share
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                          hideAutoEvent(item.content_id!)
                                        }
                                        className="size-7 rounded-lg bg-white text-xs shadow-sm"
                                        title="Hide from plan"
                                      >
                                        <X className="size-3" />
                                      </Button>
                                    </>
                                  ) : isShared ? (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        onLeaveShared(item.id, weekStart)
                                      }
                                      className="size-7 rounded-lg bg-white text-xs shadow-sm"
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
                                        className="h-7 gap-1 rounded-lg bg-white px-2 text-[10px] font-semibold shadow-sm"
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
                                        className="size-7 rounded-lg bg-white text-xs shadow-sm"
                                        title="Edit"
                                      >
                                        <Pencil className="size-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Link
                                href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
                                className="block"
                              >
                                <p className="font-medium text-sm line-clamp-2">
                                  {item.content?.title}
                                </p>
                              </Link>
                            </div>
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
                    {isToday && (
                      <Badge className="bg-[var(--primary)] text-white text-[10px]">
                        Today
                      </Badge>
                    )}
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
                                    <Badge className="bg-white/70 px-1.5 py-0.5 text-[8px] font-semibold text-[var(--accent)]">
                                      {plannedTimeLabel}
                                    </Badge>
                                  )}
                                  {isShared && (
                                    <Badge
                                      variant="muted"
                                      className="rounded bg-white/60 px-1 py-0.5 text-[8px] font-medium"
                                    >
                                      {sharedItem?.owner_name}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs font-medium line-clamp-2">
                                  {item.note_title}
                                </p>
                              </div>
                              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isShared ? (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      onLeaveShared(item.id, weekStart)
                                    }
                                    className="size-5 rounded bg-white text-[10px] shadow-sm hover:bg-white"
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
                                      className="h-5 gap-0.5 rounded bg-white px-1.5 text-[9px] font-semibold shadow-sm hover:bg-white"
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
                                      className="size-5 rounded bg-white text-[10px] shadow-sm hover:bg-white"
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

                        const Icon = categoryUI(
                          item.content?.category || "other",
                        ).icon;

                        // Content item (desktop)
                        return (
                          <div
                            key={item.id}
                            className="group relative bg-white rounded-lg overflow-hidden border border-[var(--border)]"
                          >
                            <div className="flex items-center justify-between px-2 pt-2">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Icon className="w-3 h-3 text-muted-foreground" />
                                {plannedTimeLabel && (
                                  <Badge
                                    variant="accent"
                                    className="px-1.5 py-0.5 text-[8px] font-semibold"
                                  >
                                    {plannedTimeLabel}
                                  </Badge>
                                )}
                                {isShared && (
                                  <Badge
                                    variant="muted"
                                    className="rounded px-1 py-0.5 text-[8px] font-medium"
                                  >
                                    {sharedItem?.owner_name}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-0.5">
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
                                      className="h-5 gap-0.5 rounded bg-white/90 px-1.5 text-[9px] font-semibold shadow-sm backdrop-blur hover:bg-white/90"
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
                                      className="size-5 rounded bg-white/90 text-[10px] shadow-sm backdrop-blur hover:bg-white/90"
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
                                    className="size-5 rounded bg-white/90 text-[10px] shadow-sm backdrop-blur hover:bg-white/90"
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
                                      className="h-5 gap-0.5 rounded bg-white/90 px-1.5 text-[9px] font-semibold shadow-sm backdrop-blur hover:bg-white/90"
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
                                      className="size-5 rounded bg-white/90 text-[10px] shadow-sm backdrop-blur hover:bg-white/90"
                                      title="Edit"
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
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
                              <div className="p-2 pt-1">
                                <div className="flex flex-col gap-1">
                                  <p className="text-xs font-medium line-clamp-2">
                                    {item.content?.title}
                                  </p>
                                </div>
                              </div>
                            </Link>
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
