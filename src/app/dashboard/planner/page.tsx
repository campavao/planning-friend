"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  Content,
  PlanItem,
  WeeklyPlanWithItems,
  ContentCategory,
} from "@/lib/supabase";

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

interface PlannerData {
  plan: WeeklyPlanWithItems | null;
  availableContent: Content[];
  suggestions: Record<number, Content[]>;
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
  const router = useRouter();

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-shimmer w-16 h-16 rounded-full" />
      </div>
    );
  }

  const itemsByDay: Record<number, PlanItem[]> = {};
  for (let i = 0; i <= 6; i++) {
    itemsByDay[i] =
      data?.plan?.items.filter((item) => item.day_of_week === i) || [];
  }

  return (
    <main className="min-h-screen pb-20 md:pb-8">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="px-2 md:px-3">
              ← <span className="hidden sm:inline ml-1">Back</span>
            </Button>
          </Link>
          <div className="text-center flex-1">
            <h1 className="font-semibold text-sm md:text-lg">Weekly Planner</h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Week Navigation */}
        <div className="glass rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek(-1)}
            className="px-2 md:px-3"
          >
            ← <span className="hidden sm:inline ml-1">Prev</span>
          </Button>
          <div className="text-center">
            <h2 className="text-base md:text-xl font-semibold">
              {formatWeekRange()}
            </h2>
            {isCurrentWeek() && (
              <Badge className="mt-1 text-xs">This Week</Badge>
            )}
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
                      {itemsByDay[dayIndex].map((item) => (
                        <div
                          key={item.id}
                          className="group relative glass rounded-xl overflow-hidden"
                        >
                          <div className="flex gap-3">
                            {item.content?.thumbnail_url && (
                              <img
                                src={item.content.thumbnail_url}
                                alt=""
                                className="w-20 h-20 object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 py-2 pr-8 min-w-0">
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
                              </div>
                              <p className="font-medium text-sm line-clamp-2">
                                {item.content?.title}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromDay(item.id)}
                            className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
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
                  {itemsByDay[dayIndex].map((item) => (
                    <div
                      key={item.id}
                      className="group relative glass rounded-lg overflow-hidden"
                    >
                      {item.content?.thumbnail_url && (
                        <img
                          src={item.content.thumbnail_url}
                          alt=""
                          className="w-full h-24 object-cover"
                        />
                      )}
                      <div className="p-2">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-xs">
                            {CATEGORY_EMOJI[item.content?.category || "other"]}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2">
                          {item.content?.title}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromDay(item.id)}
                        className="absolute top-1 right-1 bg-destructive/90 text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

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
              Text TikTok links to save meals, events, and date ideas.
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
    </main>
  );
}
