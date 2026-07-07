"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  usePlanner,
  type PlanItemWithSharing,
} from "@/hooks/usePlanner";
import type { Content, SharedPlanItem, Tag } from "@/lib/supabase";
import { formatDateString, parseDateString } from "@/lib/date-utils";
import {
  Calendar,
  Coffee,
  FileText,
  Gift,
  Hand,
  Heart,
  Pencil,
  Pin,
  Plus,
  Users,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SuggestionStrip } from "./SuggestionStrip";
import { formatItemTime, getItemDateKey } from "../lib/date-helpers";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  meal: Utensils,
  drink: Coffee,
  event: Calendar,
  date_idea: Heart,
  gift_idea: Gift,
  other: Pin,
};

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

  return (
    <section className="mb-8 md:mb-3" data-week={weekStart}>
      {/* Week label (mobile only — desktop reads as a continuous calendar) */}
      <div className="mb-2 px-1 flex md:hidden items-center justify-center gap-2">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {dayInfos.map(({ dayIndex, dateKey, dayOfMonth, monthShort }) => {
          const isToday = dateKey === todayKey;
          const isHighlighted = highlightDate === dateKey;
          const dayRefreshing = refreshingKey === `${weekStart}:${dayIndex}`;

          return (
            <Card
              key={dateKey}
              id={`day-${dateKey}`}
              ref={(el: HTMLDivElement | null) =>
                registerDayElement(dateKey, el)
              }
              className={`card-elevated overflow-hidden transition-shadow ${
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
                    <div className="space-y-2 animate-pulse">
                      <div className="h-16 rounded-xl bg-[var(--muted)]" />
                    </div>
                  ) : itemsByDay[dayIndex].length > 0 ? (
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
                                    <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded-full font-semibold text-[var(--accent)]">
                                      {plannedTimeLabel}
                                    </span>
                                  )}
                                  {isShared && (
                                    <span className="text-[10px] bg-[var(--muted)] px-1.5 py-0.5 rounded-full font-medium">
                                      from {sharedItem?.owner_name}
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
                                    onClick={() =>
                                      onLeaveShared(item.id, weekStart)
                                    }
                                    className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                    title="Leave"
                                  >
                                    <Hand className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => onOpenShare(ownItem!)}
                                      className="bg-white rounded-lg h-7 px-2 text-[10px] font-semibold flex items-center gap-1 shadow-sm hover:bg-[var(--muted)]"
                                      title="Share"
                                    >
                                      <Users className="w-3 h-3" />
                                      {ownItem?.shared_with?.length
                                        ? ownItem.shared_with.length
                                        : "Share"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        onOpenEdit(ownItem!, dateKey)
                                      }
                                      className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
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
                                    <span className="text-[10px] bg-[var(--accent-light)] text-[var(--accent-foreground)] px-2 py-0.5 rounded-full font-semibold">
                                      {plannedTimeLabel}
                                    </span>
                                  )}
                                  {isShared && (
                                    <span className="text-[10px] bg-[var(--muted)] px-1.5 py-0.5 rounded-full font-medium">
                                      from {sharedItem?.owner_name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isAutoEvent ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          onShareAutoEvent(ownItem!, weekStart)
                                        }
                                        className="bg-white rounded-lg h-7 px-2 text-[10px] font-semibold flex items-center gap-1 shadow-sm hover:bg-[var(--muted)]"
                                        title="Share"
                                      >
                                        <Users className="w-3 h-3" />
                                        Share
                                      </button>
                                      <button
                                        onClick={() =>
                                          hideAutoEvent(item.content_id!)
                                        }
                                        className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                        title="Hide from plan"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </>
                                  ) : isShared ? (
                                    <button
                                      onClick={() =>
                                        onLeaveShared(item.id, weekStart)
                                      }
                                      className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                      title="Leave"
                                    >
                                      <Hand className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => onOpenShare(ownItem!)}
                                        className="bg-white rounded-lg h-7 px-2 text-[10px] font-semibold flex items-center gap-1 shadow-sm hover:bg-[var(--muted)]"
                                        title="Share"
                                      >
                                        <Users className="w-3 h-3" />
                                        {ownItem?.shared_with?.length
                                          ? ownItem.shared_with.length
                                          : "Share"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          onOpenEdit(ownItem!, dateKey)
                                        }
                                        className="bg-white rounded-lg w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-[var(--muted)]"
                                        title="Edit"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
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
                    </div>
                  ) : (
                    <SuggestionStrip
                      dayIndex={dayIndex}
                      picks={filterPicksForDay(dayIndex)}
                      contentById={contentById}
                      weekStart={weekStart}
                      onAdd={(contentId, di) =>
                        onAddSuggestion(contentId, di, weekStart)
                      }
                      onDismiss={(contentId, di) =>
                        onDismissSuggestion(contentId, di, weekStart)
                      }
                      onRefresh={(di) => onRefreshSuggestions(di, weekStart)}
                      isRefreshing={dayRefreshing}
                      emptyPool={suggestionsMeta.emptyPool}
                      loading={loading}
                      layout="mobile"
                    />
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
                    <div className="space-y-2 animate-pulse pt-1">
                      <div className="h-16 rounded-lg bg-[var(--muted)]" />
                      <div className="h-8 rounded-lg bg-[var(--muted)]" />
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
                                    <span className="text-[8px] bg-white/70 px-1.5 py-0.5 rounded-full font-semibold text-[var(--accent)]">
                                      {plannedTimeLabel}
                                    </span>
                                  )}
                                  {isShared && (
                                    <span className="text-[8px] bg-white/60 px-1 py-0.5 rounded font-medium">
                                      {sharedItem?.owner_name}
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
                                    onClick={() =>
                                      onLeaveShared(item.id, weekStart)
                                    }
                                    className="bg-white rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
                                    title="Leave"
                                  >
                                    <Hand className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => onOpenShare(ownItem!)}
                                      className="bg-white rounded h-5 px-1.5 text-[9px] font-semibold flex items-center gap-0.5 shadow-sm"
                                      title="Share"
                                    >
                                      <Users className="w-3 h-3" />
                                      {ownItem?.shared_with?.length
                                        ? ownItem.shared_with.length
                                        : "Share"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        onOpenEdit(ownItem!, dateKey)
                                      }
                                      className="bg-white rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
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
                            <div className="flex items-center justify-between px-2 pt-2">
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
                              </div>
                              <div className="flex gap-0.5">
                                {isAutoEvent ? (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onShareAutoEvent(ownItem!, weekStart);
                                      }}
                                      className="bg-white/90 backdrop-blur rounded h-5 px-1.5 text-[9px] font-semibold flex items-center gap-0.5 shadow-sm"
                                      title="Share"
                                    >
                                      <Users className="w-3 h-3" />
                                      Share
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        hideAutoEvent(item.content_id!);
                                      }}
                                      className="bg-white/90 backdrop-blur rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
                                      title="Hide from plan"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : isShared ? (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onLeaveShared(item.id, weekStart);
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
                                        onOpenShare(ownItem!);
                                      }}
                                      className="bg-white/90 backdrop-blur rounded h-5 px-1.5 text-[9px] font-semibold flex items-center gap-0.5 shadow-sm"
                                      title="Share"
                                    >
                                      <Users className="w-3 h-3" />
                                      {ownItem?.shared_with?.length
                                        ? ownItem.shared_with.length
                                        : "Share"}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenEdit(ownItem!, dateKey);
                                      }}
                                      className="bg-white/90 backdrop-blur rounded w-5 h-5 text-[10px] flex items-center justify-center shadow-sm"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
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

                      {itemsByDay[dayIndex].length === 0 && (
                        <SuggestionStrip
                          dayIndex={dayIndex}
                          picks={filterPicksForDay(dayIndex)}
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
