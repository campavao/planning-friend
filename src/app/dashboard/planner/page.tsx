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
  SharedPlanDetails,
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
  sharedWithMe: SharedPlanDetails[];
  shareInfo: { isShared: boolean; sharedWith: string[] };
}

interface ShareState {
  isOpen: boolean;
  mode: "share" | "claim";
  shareCode: string;
  inputCode: string;
  loading: boolean;
  error: string;
  success: string;
}

type ViewMode = "my-plan" | { type: "shared"; planId: string; weekStart: string; ownerPhone: string };

export default function PlannerPage() {
  const [data, setData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<string>("");
  const [addingToDay, setAddingToDay] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | "all">(
    "all"
  );
  const [share, setShare] = useState<ShareState>({
    isOpen: false,
    mode: "share",
    shareCode: "",
    inputCode: "",
    loading: false,
    error: "",
    success: "",
  });
  const [showListPicker, setShowListPicker] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("my-plan");
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

  const generateShareCode = async () => {
    setShare((s) => ({ ...s, loading: true, error: "", success: "" }));
    try {
      const res = await fetch("/api/planner/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", weekStart }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setShare((s) => ({
        ...s,
        loading: false,
        shareCode: result.shareCode,
        success: "Share code generated! It expires in 7 days.",
      }));
    } catch (error) {
      setShare((s) => ({
        ...s,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to generate code",
      }));
    }
  };

  const claimShareCode = async () => {
    if (!share.inputCode.trim()) return;
    setShare((s) => ({ ...s, loading: true, error: "", success: "" }));
    try {
      const res = await fetch("/api/planner/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          shareCode: share.inputCode.trim().toUpperCase(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setShare((s) => ({
        ...s,
        loading: false,
        inputCode: "",
        success: "🎉 You've joined! The shared plan now appears in \"Shared With Me\" below.",
      }));
      fetchPlanner(weekStart);
    } catch (error) {
      setShare((s) => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to claim code",
      }));
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
      <div className="min-h-screen flex items-center justify-center bg-paper">
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
    <main className="min-h-screen pb-28 md:pb-8 bg-paper">
      {/* Scrapbook Header */}
      <div className="pt-6 pb-4 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-washi-mint/20"
            >
              ← Back
            </Button>
          </Link>
          <div className="relative">
            <h1 className="font-handwritten text-3xl md:text-4xl text-foreground transform -rotate-1">
              Weekly Plan
            </h1>
            <div className="absolute -bottom-1 left-0 right-0 h-2 bg-washi-blue/60 transform rotate-0.5 -z-10" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-washi-pink/20"
            onClick={() =>
              setShare((s) => ({ ...s, isOpen: true, mode: "share" }))
            }
          >
            🤝 Share
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-4">
        {/* Week Navigation */}
        <div className="scrapbook-card p-3 md:p-4 mb-4 md:mb-6 flex items-center justify-between relative">
          <div className="absolute -top-2 left-8 w-14 h-5 bg-washi-yellow/80 transform -rotate-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek(-1)}
            className="px-2 md:px-3"
          >
            ← <span className="hidden sm:inline ml-1">Prev</span>
          </Button>
          <div className="text-center relative">
            <h2 className="text-base md:text-xl font-semibold font-handwritten">
              {formatWeekRange()}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              {isCurrentWeek() && (
                <span className="sticker sticker-event text-[10px]">
                  This Week
                </span>
              )}
              {/* Viewing indicator */}
              {viewMode !== "my-plan" && (
                <span className="sticker sticker-date_idea text-[10px]">
                  👀 Viewing shared
                </span>
              )}
              {/* Clickable chip to show list picker */}
              {((data?.shareInfo?.isShared && data.shareInfo.sharedWith.length > 0) || 
                (data?.sharedWithMe && data.sharedWithMe.length > 0)) && (
                <button
                  onClick={() => setShowListPicker(!showListPicker)}
                  className="sticker sticker-meal text-[10px] cursor-pointer hover:scale-105 transition-transform"
                >
                  🤝 {viewMode === "my-plan" ? "My Plan" : "Shared"} 
                  {data?.sharedWithMe && data.sharedWithMe.length > 0 && ` (+${data.sharedWithMe.length})`}
                  {" ▼"}
                </button>
              )}
            </div>
            
            {/* List Picker Dropdown */}
            {showListPicker && (
              <>
                {/* Click-outside overlay */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowListPicker(false)}
                />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-72 glass rounded-xl shadow-xl border border-border/50 overflow-hidden">
                <div className="p-2 border-b border-border/50 bg-secondary/30">
                  <p className="text-xs font-medium text-muted-foreground">Choose a list to view:</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {/* My Plan Option */}
                  <button
                    onClick={() => {
                      setViewMode("my-plan");
                      setShowListPicker(false);
                      fetchPlanner(weekStart);
                    }}
                    className={`w-full p-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3 ${
                      viewMode === "my-plan" ? "bg-primary/10 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-washi-yellow/30 flex items-center justify-center text-sm">
                      📋
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">My Plan</p>
                      <p className="text-xs text-muted-foreground">Your personal weekly plan</p>
                    </div>
                    {viewMode === "my-plan" && (
                      <span className="text-primary text-xs">✓</span>
                    )}
                  </button>
                  
                  {/* Shared With Me Plans */}
                  {data?.sharedWithMe && data.sharedWithMe.length > 0 && (
                    <>
                      <div className="px-3 py-2 bg-secondary/20">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Shared with me
                        </p>
                      </div>
                      {data.sharedWithMe.map((sharedPlan) => {
                        const maskedPhone = sharedPlan.owner_phone.replace(
                          /(\+\d{1})(\d{3})(\d{3})(\d{4})/,
                          "$1 ••• ••• $4"
                        );
                        const isSelected = viewMode !== "my-plan" && 
                          viewMode.planId === sharedPlan.id;
                        const sharedWeekStart = new Date(sharedPlan.week_start);
                        const formatDate = (d: Date) =>
                          d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        
                        return (
                          <button
                            key={sharedPlan.id}
                            onClick={() => {
                              setViewMode({
                                type: "shared",
                                planId: sharedPlan.id,
                                weekStart: sharedPlan.week_start,
                                ownerPhone: sharedPlan.owner_phone,
                              });
                              setWeekStart(sharedPlan.week_start);
                              setShowListPicker(false);
                              setLoading(true);
                              fetchPlanner(sharedPlan.week_start);
                            }}
                            className={`w-full p-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3 ${
                              isSelected ? "bg-primary/10 border-l-2 border-primary" : ""
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-washi-pink/30 flex items-center justify-center text-sm">
                              👤
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{maskedPhone}</p>
                              <p className="text-xs text-muted-foreground">
                                Week of {formatDate(sharedWeekStart)}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="text-primary text-xs">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                  
                  {/* Show who you've shared with */}
                  {data?.shareInfo?.isShared && data.shareInfo.sharedWith.length > 0 && (
                    <>
                      <div className="px-3 py-2 bg-secondary/20">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          I&apos;ve shared with
                        </p>
                      </div>
                      {data.shareInfo.sharedWith.map((phone, i) => {
                        const maskedPhone = phone.replace(
                          /(\+\d{1})(\d{3})(\d{3})(\d{4})/,
                          "$1 ••• ••• $4"
                        );
                        return (
                          <div
                            key={i}
                            className="w-full p-3 text-left flex items-center gap-3 opacity-60"
                          >
                            <div className="w-8 h-8 rounded-full bg-washi-mint/30 flex items-center justify-center text-sm">
                              👤
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">{maskedPhone}</p>
                              <p className="text-xs text-muted-foreground">Can view your plan</p>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
              </>
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

        {/* Viewing Shared Plan Banner */}
        {viewMode !== "my-plan" && (
          <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between bg-washi-pink/10 border border-washi-pink/30">
            <div className="flex items-center gap-3">
              <span className="text-lg">👀</span>
              <div>
                <p className="text-sm font-medium">
                  Viewing shared plan from {viewMode.ownerPhone.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, "$1 ••• ••• $4")}
                </p>
                <p className="text-xs text-muted-foreground">
                  You&apos;re viewing someone else&apos;s weekly plan
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setViewMode("my-plan");
                const currentWeek = getCurrentWeekStart();
                setWeekStart(currentWeek);
                setLoading(true);
                fetchPlanner(currentWeek);
              }}
              className="shrink-0"
            >
              📋 Back to My Plan
            </Button>
          </div>
        )}

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
                          <Link
                            href={`/dashboard/${item.content_id}`}
                            className="flex gap-3"
                          >
                            {item.content?.thumbnail_url && (
                              <img
                                src={item.content.thumbnail_url}
                                alt=""
                                className="w-20 h-20 object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 py-2 pr-10 min-w-0">
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
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeFromDay(item.id);
                            }}
                            className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground rounded-full w-7 h-7 text-sm flex items-center justify-center shadow-md"
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
                      <Link
                        href={`/dashboard/${item.content_id}`}
                        className="block"
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
                              {
                                CATEGORY_EMOJI[
                                  item.content?.category || "other"
                                ]
                              }
                            </span>
                          </div>
                          <p className="text-xs font-medium line-clamp-2">
                            {item.content?.title}
                          </p>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFromDay(item.id);
                        }}
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

        {/* Shared With Me Section */}
        {data?.sharedWithMe && data.sharedWithMe.length > 0 && (
          <div className="scrapbook-card p-4 md:p-5 mt-6 relative">
            <div className="absolute -top-2 left-8 w-16 h-5 bg-washi-mint/80 transform rotate-1" />
            <div className="flex items-center justify-between mb-4 pt-2">
              <h2 className="font-handwritten text-xl">🤝 Shared With Me</h2>
              <Badge variant="secondary" className="text-xs">
                {data.sharedWithMe.length} plan{data.sharedWithMe.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Plans that others have shared with you. Click to view them.
            </p>
            <div className="space-y-2">
              {data.sharedWithMe.map((sharedPlan) => {
                const sharedWeekStart = new Date(sharedPlan.week_start);
                const sharedWeekEnd = new Date(sharedWeekStart);
                sharedWeekEnd.setDate(sharedWeekEnd.getDate() + 6);
                const formatDate = (d: Date) =>
                  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const weekRange = `${formatDate(sharedWeekStart)} - ${formatDate(sharedWeekEnd)}`;
                const isThisWeek = sharedPlan.week_start === getCurrentWeekStart();
                const maskedPhone = sharedPlan.owner_phone.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, "$1 ••• ••• $4");
                const isSelected = viewMode !== "my-plan" && viewMode.planId === sharedPlan.id;
                
                return (
                  <button
                    key={sharedPlan.id}
                    onClick={() => {
                      setViewMode({
                        type: "shared",
                        planId: sharedPlan.id,
                        weekStart: sharedPlan.week_start,
                        ownerPhone: sharedPlan.owner_phone,
                      });
                      setWeekStart(sharedPlan.week_start);
                      setLoading(true);
                      fetchPlanner(sharedPlan.week_start);
                    }}
                    className={`w-full glass rounded-xl p-4 text-left hover:bg-secondary/50 transition-colors flex items-center justify-between group ${
                      isSelected ? "ring-2 ring-primary/50 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-washi-pink/30 flex items-center justify-center text-lg">
                        📅
                      </div>
                      <div>
                        <p className="font-medium text-sm md:text-base">{weekRange}</p>
                        <p className="text-xs text-muted-foreground">
                          Shared by {maskedPhone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <Badge variant="default" className="text-[10px]">
                          Viewing
                        </Badge>
                      )}
                      {isThisWeek && !isSelected && (
                        <Badge variant="secondary" className="text-[10px]">
                          This Week
                        </Badge>
                      )}
                      <span className="text-muted-foreground group-hover:text-primary transition-colors">
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
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

      {/* Share Modal */}
      {share.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold">
                {share.mode === "share" ? "Share Planner" : "Join Planner"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setShare({
                    isOpen: false,
                    mode: "share",
                    shareCode: "",
                    inputCode: "",
                    loading: false,
                    error: "",
                    success: "",
                  })
                }
              >
                ×
              </Button>
            </div>

            {/* Mode Toggle */}
            <div className="flex p-2 gap-2 border-b border-border/50">
              <Button
                variant={share.mode === "share" ? "default" : "ghost"}
                size="sm"
                onClick={() =>
                  setShare((s) => ({
                    ...s,
                    mode: "share",
                    error: "",
                    success: "",
                  }))
                }
                className="flex-1"
              >
                Share My Plan
              </Button>
              <Button
                variant={share.mode === "claim" ? "default" : "ghost"}
                size="sm"
                onClick={() =>
                  setShare((s) => ({
                    ...s,
                    mode: "claim",
                    error: "",
                    success: "",
                  }))
                }
                className="flex-1"
              >
                Join with Code
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {share.mode === "share" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Generate a share code to let others view and edit your
                    weekly planner.
                  </p>
                  {share.shareCode ? (
                    <div className="text-center space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Share this code:
                      </p>
                      <div className="text-3xl font-mono font-bold tracking-widest bg-secondary/50 rounded-xl py-4">
                        {share.shareCode}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(share.shareCode);
                          setShare((s) => ({
                            ...s,
                            success: "Copied to clipboard!",
                          }));
                        }}
                      >
                        📋 Copy Code
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={generateShareCode}
                      disabled={share.loading}
                      className="w-full"
                    >
                      {share.loading ? "Generating..." : "Generate Share Code"}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Enter a share code to join someone else&apos;s weekly
                    planner.
                  </p>
                  <div className="space-y-3">
                    <Input
                      value={share.inputCode}
                      onChange={(e) =>
                        setShare((s) => ({
                          ...s,
                          inputCode: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Enter share code"
                      className="text-center font-mono text-lg tracking-widest"
                      maxLength={8}
                    />
                    <Button
                      onClick={claimShareCode}
                      disabled={share.loading || !share.inputCode.trim()}
                      className="w-full"
                    >
                      {share.loading ? "Joining..." : "Join Planner"}
                    </Button>
                  </div>
                </>
              )}

              {share.error && (
                <p className="text-sm text-destructive text-center">
                  {share.error}
                </p>
              )}
              {share.success && (
                <p className="text-sm text-primary text-center">
                  {share.success}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
