"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Content, PlanItem, WeeklyPlanWithItems, ContentCategory } from "@/lib/supabase";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_EMOJIS = ["🌅", "🌤️", "🌥️", "⛅", "🌙", "🎉", "☀️"];

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
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | "all">("all");
  const router = useRouter();

  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    return monday.toISOString().split("T")[0];
  };

  const fetchPlanner = useCallback(async (week?: string) => {
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
  }, [router, weekStart]);

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
      const res = await fetch(`/api/planner/item?id=${itemId}`, { method: "DELETE" });
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
    const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

  // Filter content for the picker
  const getFilteredContent = () => {
    if (!data?.availableContent) return [];
    
    const usedIds = new Set(data.plan?.items.map((i) => i.content_id) || []);
    
    return data.availableContent.filter((c) => {
      if (usedIds.has(c.id)) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
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
    itemsByDay[i] = data?.plan?.items.filter((item) => item.day_of_week === i) || [];
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
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Week Navigation */}
        <div className="glass rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)} className="px-2 md:px-3">
            ← <span className="hidden sm:inline ml-1">Prev</span>
          </Button>
          <div className="text-center">
            <h2 className="text-base md:text-xl font-semibold">{formatWeekRange()}</h2>
            {isCurrentWeek() && <Badge className="mt-1 text-xs">This Week</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)} className="px-2 md:px-3">
            <span className="hidden sm:inline mr-1">Next</span> →
          </Button>
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-1 md:gap-3">
          {DAYS.map((day, dayIndex) => (
            <Card
              key={day}
              className={`glass min-h-[120px] md:min-h-[200px] ${
                isToday(dayIndex) ? "border-primary/50 ring-1 md:ring-2 ring-primary/20" : ""
              }`}
            >
              <CardHeader className="p-2 md:pb-2 text-center">
                <div className="text-lg md:text-2xl">{DAY_EMOJIS[dayIndex]}</div>
                <CardTitle className="text-xs md:text-sm font-medium">
                  <span className="md:hidden">{day}</span>
                  <span className="hidden md:inline">{DAYS_FULL[dayIndex]}</span>
                  <span className="block text-lg md:text-2xl font-bold text-primary">
                    {getDateForDay(dayIndex)}
                  </span>
                </CardTitle>
                {isToday(dayIndex) && (
                  <Badge className="mx-auto text-[10px] md:text-xs px-1 md:px-2">Today</Badge>
                )}
              </CardHeader>
              <CardContent className="p-1 md:p-3 pt-0 space-y-1 md:space-y-2">
                {/* Items */}
                {itemsByDay[dayIndex].map((item) => (
                  <div
                    key={item.id}
                    className="group relative glass rounded p-1 md:p-2 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs md:text-sm">
                        {CATEGORY_EMOJI[item.content?.category || "other"]}
                      </span>
                      <span className="text-[10px] md:text-xs line-clamp-1 flex-1">
                        {item.content?.title}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromDay(item.id)}
                      className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full w-4 h-4 md:w-5 md:h-5 text-[10px] md:text-xs flex items-center justify-center transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Suggestions on empty days */}
                {itemsByDay[dayIndex].length === 0 &&
                  data?.suggestions?.[dayIndex]?.[0] && (
                    <button
                      onClick={() => addToDay(data.suggestions[dayIndex][0].id, dayIndex)}
                      className="w-full glass rounded p-1 md:p-2 text-left hover:bg-primary/10 transition-colors border border-dashed border-primary/30"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs md:text-sm">
                          {CATEGORY_EMOJI[data.suggestions[dayIndex][0].category]}
                        </span>
                        <span className="text-[10px] md:text-xs line-clamp-1 text-muted-foreground">
                          {data.suggestions[dayIndex][0].title}
                        </span>
                      </div>
                    </button>
                  )}

                {/* Add Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 md:h-8 text-[10px] md:text-xs border border-dashed"
                  onClick={() => setAddingToDay(dayIndex)}
                >
                  +
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {data?.availableContent.length === 0 && (
          <div className="glass rounded-2xl p-6 md:p-8 mt-6 text-center">
            <p className="text-lg md:text-xl mb-2">📱 No saved content yet!</p>
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
              <h3 className="font-semibold">
                Add to {DAYS_FULL[addingToDay]}
              </h3>
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
                  🍽️ Meals
                </Button>
                <Button
                  variant={categoryFilter === "event" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("event")}
                  className="shrink-0"
                >
                  🎉 Events
                </Button>
                <Button
                  variant={categoryFilter === "date_idea" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("date_idea")}
                  className="shrink-0"
                >
                  💕 Dates
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
                      className="w-12 h-12 object-cover rounded-lg shrink-0"
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
