"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Content, PlanItem, WeeklyPlanWithItems } from "@/lib/supabase";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_EMOJIS = ["🌅", "🌤️", "🌥️", "⛅", "🌙", "🎉", "☀️"];

interface PlannerData {
  plan: WeeklyPlanWithItems | null;
  availableContent: Content[];
  suggestions: Record<number, Content[]>;
}

export default function PlannerPage() {
  const [data, setData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<string>("");
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const router = useRouter();

  // Get current week's Monday
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
        body: JSON.stringify({
          weekStart,
          contentId,
          dayOfWeek,
        }),
      });

      if (res.ok) {
        fetchPlanner(weekStart);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
    setAddingTo(null);
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

  const isCurrentWeek = () => {
    return weekStart === getCurrentWeekStart();
  };

  const getDateForDay = (dayIndex: number) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return date.getDate();
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                ← Back
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold text-lg">Weekly Planner</h1>
              <p className="text-xs text-muted-foreground">
                Plan your week ahead
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Week Navigation */}
        <div className="glass rounded-2xl p-4 mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigateWeek(-1)}
          >
            ← Previous
          </Button>
          <div className="text-center">
            <h2 className="text-xl font-semibold">{formatWeekRange()}</h2>
            {isCurrentWeek() && (
              <Badge className="mt-1">This Week</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => navigateWeek(1)}
          >
            Next →
          </Button>
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map((day, dayIndex) => (
            <DayColumn
              key={day}
              day={day}
              dayIndex={dayIndex}
              dateNumber={getDateForDay(dayIndex)}
              emoji={DAY_EMOJIS[dayIndex]}
              items={itemsByDay[dayIndex]}
              suggestions={data?.suggestions[dayIndex] || []}
              availableContent={data?.availableContent || []}
              isAddingTo={addingTo === dayIndex}
              onAddClick={() => setAddingTo(addingTo === dayIndex ? null : dayIndex)}
              onAdd={(contentId) => addToDay(contentId, dayIndex)}
              onRemove={removeFromDay}
            />
          ))}
        </div>

        {/* Help Text */}
        {data?.availableContent.length === 0 && (
          <div className="glass rounded-2xl p-8 mt-6 text-center">
            <p className="text-xl mb-2">📱 No saved content yet!</p>
            <p className="text-muted-foreground mb-4">
              Text TikTok links to your number to save meals, events, and date ideas.
              Then come back here to plan your week!
            </p>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

interface DayColumnProps {
  day: string;
  dayIndex: number;
  dateNumber: number;
  emoji: string;
  items: PlanItem[];
  suggestions: Content[];
  availableContent: Content[];
  isAddingTo: boolean;
  onAddClick: () => void;
  onAdd: (contentId: string) => void;
  onRemove: (itemId: string) => void;
}

function DayColumn({
  day,
  dayIndex,
  dateNumber,
  emoji,
  items,
  suggestions,
  availableContent,
  isAddingTo,
  onAddClick,
  onAdd,
  onRemove,
}: DayColumnProps) {
  const categoryEmoji: Record<string, string> = {
    meal: "🍽️",
    event: "🎉",
    date_idea: "💕",
    other: "📌",
  };

  const isToday = () => {
    const today = new Date();
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - dayDate.getDay() + (dayDate.getDay() === 0 ? -6 : 1) + dayIndex);
    return today.toDateString() === dayDate.toDateString();
  };

  // Filter available content to only show items not already in the plan this day
  const usedIds = new Set(items.map((i) => i.content_id));
  const filteredAvailable = availableContent.filter((c) => !usedIds.has(c.id));

  return (
    <Card className={`glass ${isToday() ? "border-primary/50 ring-2 ring-primary/20" : ""}`}>
      <CardHeader className="pb-2 text-center">
        <div className="text-2xl">{emoji}</div>
        <CardTitle className="text-sm font-medium">
          {day}
          <span className="block text-2xl font-bold text-primary">{dateNumber}</span>
        </CardTitle>
        {isToday() && <Badge className="mx-auto">Today</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Existing Items */}
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative glass rounded-lg p-2 hover:bg-secondary/50 transition-colors"
          >
            {item.content?.thumbnail_url && (
              <img
                src={item.content.thumbnail_url}
                alt=""
                className="w-full h-16 object-cover rounded mb-2"
              />
            )}
            <div className="flex items-start gap-2">
              <span>{categoryEmoji[item.content?.category || "other"]}</span>
              <span className="text-xs line-clamp-2 flex-1">
                {item.content?.title}
              </span>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/20 rounded p-1 text-xs transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Suggestions */}
        {items.length === 0 && suggestions.length > 0 && !isAddingTo && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Suggestions:</p>
            {suggestions.slice(0, 2).map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => onAdd(suggestion.id)}
                className="w-full glass rounded-lg p-2 text-left hover:bg-primary/10 transition-colors border border-dashed border-primary/30"
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">{categoryEmoji[suggestion.category]}</span>
                  <span className="text-xs line-clamp-2">{suggestion.title}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Add Button / Picker */}
        {isAddingTo ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-muted-foreground">Select item:</p>
            {filteredAvailable.map((content) => (
              <button
                key={content.id}
                onClick={() => onAdd(content.id)}
                className="w-full glass rounded-lg p-2 text-left hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span>{categoryEmoji[content.category]}</span>
                  <span className="text-xs line-clamp-1">{content.title}</span>
                </div>
              </button>
            ))}
            {filteredAvailable.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No more items to add
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onAddClick}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-dashed"
            onClick={onAddClick}
          >
            + Add
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

