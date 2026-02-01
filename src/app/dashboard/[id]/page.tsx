"use client";

import { TagPills } from "@/components/tag-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContentById, useTags } from "@/hooks/useContent";
import { DEFAULT_TAGS } from "@/lib/constants";
import type {
  DateIdeaData,
  DrinkData,
  EventData,
  GiftIdeaData,
  MealData,
  TravelData,
} from "@/lib/supabase";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  Coffee,
  ExternalLink,
  Gift,
  Heart,
  Loader2,
  MapPin,
  Pencil,
  Pin,
  Plane,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Utensils,
  XCircle,
  Check,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../useSession";

// Category config
const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  meal: { icon: Utensils, label: "Recipe", color: "text-[var(--meal)]", bg: "bg-[var(--meal-bg)]" },
  drink: { icon: Coffee, label: "Drink", color: "text-[var(--drink)]", bg: "bg-[var(--drink-bg)]" },
  event: { icon: Calendar, label: "Event", color: "text-[var(--event)]", bg: "bg-[var(--event-bg)]" },
  date_idea: { icon: Heart, label: "Date", color: "text-[var(--date)]", bg: "bg-[var(--date-bg)]" },
  gift_idea: { icon: Gift, label: "Gift", color: "text-[var(--gift)]", bg: "bg-[var(--gift-bg)]" },
  travel: { icon: Plane, label: "Travel", color: "text-[var(--travel)]", bg: "bg-[var(--travel-bg)]" },
  other: { icon: Pin, label: "Saved", color: "text-[var(--other)]", bg: "bg-[var(--other-bg)]" },
};

// Generate Google Maps URL from location string
function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

// Check if the URL is an image-only placeholder (not a real URL)
function isImageOnlyContent(url: string): boolean {
  return url.startsWith("mms://image/");
}

// Get appropriate link text for the source URL
function getSourceLinkText(url: string): string | null {
  if (isImageOnlyContent(url)) {
    return null;
  }
  if (
    url.includes("tiktok.com") ||
    url.includes("vm.tiktok.com") ||
    url.includes("vt.tiktok.com")
  ) {
    return "Watch on TikTok";
  }
  if (url.includes("instagram.com") || url.includes("instagr.am")) {
    return "View on Instagram";
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return `Visit ${hostname}`;
  } catch {
    return "Visit Website";
  }
}

export default function ContentDetailPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const {
    content,
    tags,
    isLoading: contentLoading,
    mutate: mutateContent,
  } = useContentById(id, { enabled: !!user });

  const { tags: allTags, mutate: mutateTags } = useTags({ enabled: !!user });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isEditable = content?.user_id === user?.id;
  const loading = sessionLoading || (!!user && contentLoading && !content);

  useEffect(() => {
    if (content) {
      setEditTitle(content.title);
      setEditCategory(content.category);
    }
  }, [content]);

  const handleBack = useCallback(() => {
    const from = searchParams.get("from");
    const week = searchParams.get("week");

    if (from === "planner" && week) {
      router.push(`/dashboard/planner?week=${week}`);
    } else {
      router.push("/dashboard");
    }
  }, [router, searchParams]);

  const handleAddTag = async (name: string) => {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contentId: id }),
      });
      if (res.ok) {
        mutateContent();
        mutateTags();
      }
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleAddExistingTag = async (tagId: string) => {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, contentId: id }),
      });
      if (res.ok) {
        mutateContent();
      }
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tags?tagId=${tagId}&contentId=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        mutateContent();
      }
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  useEffect(() => {
    if (content?.status !== "processing") return;

    const interval = setInterval(() => {
      mutateContent();
    }, 3000);

    return () => clearInterval(interval);
  }, [content?.status, mutateContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, category: editCategory }),
      });

      if (res.ok) {
        mutateContent();
        setEditing(false);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleRetryProcessing = async () => {
    if (!content) return;

    setRetrying(true);
    setRetryFeedback(null);
    try {
      const res = await fetch(`/api/content/${content.id}/reprocess`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start retry");
      }

      setRetryFeedback({
        type: "success",
        message: "Retrying...",
      });
      mutateContent();
    } catch (error) {
      setRetryFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card-elevated p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-medium">Content not found</p>
        </div>
      </div>
    );
  }

  const config = CATEGORY_CONFIG[content.category] || CATEGORY_CONFIG.other;
  const Icon = config.icon;

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="btn-ghost"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {content.status === "completed" && isEditable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRetryProcessing}
                  disabled={retrying}
                  className="btn-ghost"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(!editing)}
                  className="btn-ghost"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-destructive hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Processing State */}
        {content.status === "processing" && (
          <div className="card-elevated state-processing p-8 text-center mb-8 animate-slide-up">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h2 className="heading-2 mb-2">Processing</h2>
            <p className="text-muted-foreground mb-4">Almost done...</p>
            <div className="loading-bar w-48 mx-auto mb-4" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetryProcessing}
              disabled={retrying}
              className="btn-secondary"
            >
              {retrying ? "..." : "Retry"}
            </Button>
          </div>
        )}

        {/* Failed State */}
        {content.status === "failed" && (
          <div className="card-elevated state-error p-8 text-center mb-8 animate-slide-up">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="heading-2 mb-2">Failed</h2>
            <p className="text-muted-foreground mb-4">
              Couldn&apos;t process this link
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleRetryProcessing}
                disabled={retrying}
                className="btn-primary"
              >
                {retrying ? "..." : "Retry"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="btn-outline border-destructive text-destructive hover:bg-destructive hover:text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="card-elevated overflow-hidden animate-slide-up">
          {content.thumbnail_url && (
            <div className="relative h-56 md:h-80">
              <Image
                src={content.thumbnail_url}
                alt={content.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          {/* Category Badge */}
          <div className="px-6 pt-6">
            {editing ? (
              <div className="relative inline-block">
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="input-modern text-sm pl-4 pr-10 py-2 font-semibold appearance-none cursor-pointer"
                >
                  <option value="meal">Recipe</option>
                  <option value="drink">Drink</option>
                  <option value="event">Event</option>
                  <option value="date_idea">Date</option>
                  <option value="gift_idea">Gift</option>
                  <option value="travel">Travel</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
              </div>
            ) : (
              <span className={`badge ${config.bg} ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </span>
            )}
          </div>

          <div className="px-6 pt-4 pb-2">
            {editing ? (
              <div className="flex gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-modern text-xl font-semibold"
                  placeholder="Title"
                />
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? "..." : "Save"}
                </Button>
              </div>
            ) : (
              <h1 className="heading-2">{content.title}</h1>
            )}

            {/* Tags */}
            {isEditable && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Tags
                </p>
                <TagPills
                  tags={tags}
                  editable={true}
                  allTags={allTags}
                  suggestions={DEFAULT_TAGS}
                  onAdd={handleAddTag}
                  onRemove={handleRemoveTag}
                  onAddExisting={handleAddExistingTag}
                />
              </div>
            )}
          </div>

          <div className="px-6 pb-6 space-y-6">
            {/* Category-specific content */}
            {content.category === "meal" && (
              <MealContent data={content.data as MealData} />
            )}
            {content.category === "event" && (
              <EventContent data={content.data as EventData} />
            )}
            {content.category === "date_idea" && (
              <DateIdeaContent data={content.data as DateIdeaData} />
            )}
            {content.category === "gift_idea" && (
              <GiftIdeaContent data={content.data as GiftIdeaData} />
            )}
            {content.category === "drink" && (
              <DrinkContent data={content.data as DrinkData} />
            )}
            {content.category === "travel" && (
              <TravelContent data={content.data as TravelData} />
            )}
            {content.category === "other" && (
              <OtherContent data={content.data as { description?: string }} />
            )}

            {/* Source Link */}
            {!isImageOnlyContent(content.tiktok_url) && (
              <div className="pt-6 border-t border-[var(--border)]">
                <a
                  href={content.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl"
                >
                  {getSourceLinkText(content.tiktok_url)}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Metadata */}
            <p className="text-sm text-muted-foreground">
              Saved {new Date(content.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function MealContent({ data }: { data: MealData }) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );

  const toggleStep = (stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {data.ingredients && data.ingredients.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Ingredients</h3>
          <div className="card-flat overflow-hidden divide-y divide-[var(--border)]">
            {data.ingredients.map((ingredient, i) => {
              const isChecked = checkedIngredients.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleIngredient(i)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    isChecked ? "bg-[var(--meal-bg)]" : "hover:bg-[var(--muted)]"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-[var(--meal)] border-[var(--meal)] text-white"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {isChecked && <Check className="w-4 h-4" />}
                  </span>
                  <span
                    className={
                      isChecked ? "line-through text-muted-foreground" : ""
                    }
                  >
                    {ingredient}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data.recipe && data.recipe.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Instructions</h3>
          <ol className="space-y-4">
            {data.recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <button
                  onClick={() => toggleStep(i)}
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-semibold transition-colors ${
                    completedSteps.has(i)
                      ? "bg-[var(--meal)] text-white"
                      : "bg-[var(--primary)] text-white"
                  }`}
                >
                  {completedSteps.has(i) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    i + 1
                  )}
                </button>
                <span className="pt-2 flex-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(data.prep_time || data.cook_time || data.servings) && (
        <div className="flex flex-wrap gap-3 pt-4">
          {data.prep_time && (
            <div className="card-flat px-4 py-3 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Prep
              </p>
              <p className="font-semibold flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                {data.prep_time}
              </p>
            </div>
          )}
          {data.cook_time && (
            <div className="card-flat px-4 py-3 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Cook
              </p>
              <p className="font-semibold flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                {data.cook_time}
              </p>
            </div>
          )}
          {data.servings && (
            <div className="card-flat px-4 py-3 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Servings
              </p>
              <p className="font-semibold mt-1">{data.servings}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventContent({ data }: { data: EventData }) {
  return (
    <div className="space-y-4">
      {data.location && (
        <a
          href={getGoogleMapsUrl(data.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 card-flat rounded-xl hover:bg-[var(--muted)] transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--event-bg)] flex items-center justify-center">
            <MapPin className="w-6 h-6 text-[var(--event)]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Location
            </p>
            <p className="font-semibold">{data.location}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground mt-1" />
        </a>
      )}

      {(data.date || data.time) && (
        <div className="flex items-start gap-4 p-4 card-flat rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-[var(--event-bg)] flex items-center justify-center">
            <Calendar className="w-6 h-6 text-[var(--event)]" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              When
            </p>
            <p className="font-semibold">
              {data.date}
              {data.date && data.time && " • "}
              {data.time}
            </p>
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="heading-3 mb-2">About</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.requires_reservation && (
          <Badge variant="outline">Reservation Required</Badge>
        )}
        {data.requires_ticket && (
          <Badge variant="outline">Ticket Required</Badge>
        )}
      </div>
    </div>
  );
}

function DateIdeaContent({ data }: { data: DateIdeaData }) {
  return (
    <div className="space-y-4">
      {data.location && (
        <a
          href={getGoogleMapsUrl(data.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 card-flat rounded-xl hover:bg-[var(--muted)] transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--date-bg)] flex items-center justify-center">
            <MapPin className="w-6 h-6 text-[var(--date)]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Location
            </p>
            <p className="font-semibold">{data.location}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground mt-1" />
        </a>
      )}

      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge variant="date" className="capitalize">{data.type}</Badge>
        )}
        {data.price_range && (
          <Badge variant="outline">{data.price_range}</Badge>
        )}
      </div>

      {data.description && (
        <div>
          <h3 className="heading-3 mb-2">Why it&apos;s great</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}
    </div>
  );
}

function GiftIdeaContent({ data }: { data: GiftIdeaData }) {
  return (
    <div className="space-y-4">
      {data.cost && (
        <div className="flex items-start gap-4 p-4 card-flat rounded-xl bg-[var(--gift-bg)]">
          <div className="w-12 h-12 rounded-xl bg-[var(--gift)] flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Price
            </p>
            <p className="text-2xl font-bold text-[var(--gift)]">
              {data.cost}
            </p>
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="heading-3 mb-2">About this gift</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-4">
        {data.amazon_link && (
          <a
            href={data.amazon_link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
          >
            <ShoppingCart className="w-4 h-4" />
            Amazon
          </a>
        )}
        {data.purchase_link && (
          <a
            href={data.purchase_link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl"
          >
            <ExternalLink className="w-4 h-4" />
            Buy Now
          </a>
        )}
      </div>
    </div>
  );
}

function DrinkContent({ data }: { data: DrinkData }) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );

  const toggleStep = (stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge variant="drink" className="capitalize">{data.type}</Badge>
        )}
        {data.difficulty && (
          <Badge variant="outline" className="capitalize">{data.difficulty}</Badge>
        )}
        {data.prep_time && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {data.prep_time}
          </Badge>
        )}
      </div>

      {data.ingredients && data.ingredients.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Ingredients</h3>
          <div className="card-flat overflow-hidden divide-y divide-[var(--border)]">
            {data.ingredients.map((ingredient, i) => {
              const isChecked = checkedIngredients.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleIngredient(i)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    isChecked ? "bg-[var(--drink-bg)]" : "hover:bg-[var(--muted)]"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-[var(--drink)] border-[var(--drink)] text-white"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {isChecked && <Check className="w-4 h-4" />}
                  </span>
                  <span
                    className={
                      isChecked ? "line-through text-muted-foreground" : ""
                    }
                  >
                    {ingredient}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data.recipe && data.recipe.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Instructions</h3>
          <ol className="space-y-4">
            {data.recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <button
                  onClick={() => toggleStep(i)}
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-semibold transition-colors ${
                    completedSteps.has(i)
                      ? "bg-[var(--drink)] text-white"
                      : "bg-[var(--primary)] text-white"
                  }`}
                >
                  {completedSteps.has(i) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    i + 1
                  )}
                </button>
                <span className="pt-2 flex-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TravelContent({ data }: { data: TravelData }) {
  return (
    <div className="space-y-4">
      {data.location && (
        <a
          href={getGoogleMapsUrl(data.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 card-flat rounded-xl hover:bg-[var(--muted)] transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--travel-bg)] flex items-center justify-center">
            <MapPin className="w-6 h-6 text-[var(--travel)]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Location
            </p>
            <p className="font-semibold">{data.location}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground mt-1" />
        </a>
      )}

      {(data.destination_city || data.destination_country) && (
        <div className="flex items-start gap-4 p-4 card-flat rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-[var(--travel-bg)] flex items-center justify-center">
            <Plane className="w-6 h-6 text-[var(--travel)]" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Destination
            </p>
            <p className="font-semibold">
              {data.destination_city}
              {data.destination_city && data.destination_country && ", "}
              {data.destination_country}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge variant="travel" className="capitalize">{data.type}</Badge>
        )}
        {data.price_range && (
          <Badge variant="outline">{data.price_range}</Badge>
        )}
      </div>

      {data.description && (
        <div>
          <h3 className="heading-3 mb-2">About</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}
    </div>
  );
}

function OtherContent({ data }: { data: { description?: string } }) {
  return (
    <div>
      {data.description && (
        <p className="text-muted-foreground">{data.description}</p>
      )}
    </div>
  );
}
