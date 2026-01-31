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
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../useSession";

// Category config
const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; badgeClass: string }
> = {
  meal: { icon: Utensils, label: "Recipe", badgeClass: "brutal-badge-meal" },
  drink: { icon: Coffee, label: "Drink", badgeClass: "brutal-badge-drink" },
  event: { icon: Calendar, label: "Event", badgeClass: "brutal-badge-event" },
  date_idea: { icon: Heart, label: "Date", badgeClass: "brutal-badge-date_idea" },
  gift_idea: { icon: Gift, label: "Gift", badgeClass: "brutal-badge-gift_idea" },
  travel: { icon: Plane, label: "Travel", badgeClass: "brutal-badge-travel" },
  other: { icon: Pin, label: "Saved", badgeClass: "brutal-badge-other" },
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
        <div className="brutal-loading w-32">
          <div className="brutal-loading-bar" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutal-card-static p-8 text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="font-mono uppercase">Content not found</p>
        </div>
      </div>
    );
  }

  const config = CATEGORY_CONFIG[content.category] || CATEGORY_CONFIG.other;
  const Icon = config.icon;

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="border-b-[3px] border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="border-[3px] border-border hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {content.status === "completed" && isEditable && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetryProcessing}
                  disabled={retrying}
                  className="border-[3px] border-border hover:bg-accent"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(!editing)}
                  className="border-[3px] border-border hover:bg-accent"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="border-[3px] border-destructive text-destructive hover:bg-destructive/10"
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
          <div className="brutal-card-static brutal-processing p-8 text-center mb-8">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" />
            <h2 className="font-mono text-xl font-bold uppercase mb-2">
              Processing
            </h2>
            <p className="text-muted-foreground mb-4">Almost done...</p>
            <div className="brutal-loading w-48 mx-auto mb-4">
              <div className="brutal-loading-bar" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetryProcessing}
              disabled={retrying}
              className="brutal-btn bg-secondary text-secondary-foreground"
            >
              {retrying ? "..." : "Retry"}
            </Button>
          </div>
        )}

        {/* Failed State */}
        {content.status === "failed" && (
          <div className="brutal-card-static brutal-error p-8 text-center mb-8">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="font-mono text-xl font-bold uppercase mb-2">
              Failed
            </h2>
            <p className="text-muted-foreground mb-4">
              Couldn&apos;t process this link
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleRetryProcessing}
                disabled={retrying}
                className="brutal-btn"
              >
                {retrying ? "..." : "Retry"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="border-[3px] border-destructive text-destructive hover:bg-destructive/10"
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="brutal-card-static overflow-hidden">
          {content.thumbnail_url && (
            <div className="relative h-56 md:h-72 border-b-[3px] border-border">
              <Image
                src={content.thumbnail_url}
                alt={content.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Category Badge */}
          <div className="px-6 pt-6">
            {editing ? (
              <div className="relative inline-block">
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="brutal-input text-sm pl-4 pr-10 py-2 font-bold uppercase appearance-none cursor-pointer"
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
              <span className={`brutal-badge ${config.badgeClass}`}>
                <Icon className="w-3 h-3" />
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
                  className="brutal-input text-xl font-bold"
                  placeholder="Title"
                />
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="brutal-btn"
                >
                  {saving ? "..." : "Save"}
                </Button>
              </div>
            ) : (
              <h1 className="text-xl md:text-2xl font-bold">{content.title}</h1>
            )}

            {/* Tags */}
            {isEditable && (
              <div className="mt-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
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
              <div className="pt-6 border-t-[3px] border-border">
                <a
                  href={content.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-btn inline-flex items-center gap-2 px-6 py-3"
                >
                  {getSourceLinkText(content.tiktok_url)}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Metadata */}
            <p className="text-sm text-muted-foreground font-mono">
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

  return (
    <div className="space-y-6">
      {data.ingredients && data.ingredients.length > 0 && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-3">Ingredients</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.ingredients.map((ingredient, i) => (
              <li
                key={i}
                className="flex items-start gap-2 p-2 bg-secondary border-2 border-border"
              >
                <span className="text-primary font-bold">•</span>
                <span>{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recipe && data.recipe.length > 0 && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-3">Instructions</h3>
          <ol className="space-y-3">
            {data.recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <button
                  onClick={() => toggleStep(i)}
                  className={`shrink-0 w-8 h-8 flex items-center justify-center font-mono font-bold border-2 border-border transition-colors ${
                    completedSteps.has(i)
                      ? "bg-green-500 text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(data.prep_time || data.cook_time || data.servings) && (
        <div className="flex flex-wrap gap-4 pt-4">
          {data.prep_time && (
            <div className="brutal-card-static px-4 py-2">
              <p className="text-xs font-mono uppercase text-muted-foreground">
                Prep
              </p>
              <p className="font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {data.prep_time}
              </p>
            </div>
          )}
          {data.cook_time && (
            <div className="brutal-card-static px-4 py-2">
              <p className="text-xs font-mono uppercase text-muted-foreground">
                Cook
              </p>
              <p className="font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {data.cook_time}
              </p>
            </div>
          )}
          {data.servings && (
            <div className="brutal-card-static px-4 py-2">
              <p className="text-xs font-mono uppercase text-muted-foreground">
                Servings
              </p>
              <p className="font-bold">{data.servings}</p>
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
          className="flex items-start gap-3 p-4 brutal-card hover:bg-accent"
        >
          <MapPin className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-mono uppercase text-muted-foreground">
              Location
            </p>
            <p className="font-bold">{data.location}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      )}

      {(data.date || data.time) && (
        <div className="flex items-start gap-3 p-4 brutal-card-static">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <p className="text-xs font-mono uppercase text-muted-foreground">
              When
            </p>
            <p className="font-bold">
              {data.date}
              {data.date && data.time && " / "}
              {data.time}
            </p>
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-2">About</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.requires_reservation && (
          <Badge className="brutal-badge">Reservation Required</Badge>
        )}
        {data.requires_ticket && (
          <Badge className="brutal-badge">Ticket Required</Badge>
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
          className="flex items-start gap-3 p-4 brutal-card hover:bg-accent"
        >
          <MapPin className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-mono uppercase text-muted-foreground">
              Location
            </p>
            <p className="font-bold">{data.location}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      )}

      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge className="brutal-badge capitalize">{data.type}</Badge>
        )}
        {data.price_range && (
          <Badge className="brutal-badge">{data.price_range}</Badge>
        )}
      </div>

      {data.description && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-2">
            Why it&apos;s great
          </h3>
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
        <div className="flex items-start gap-3 p-4 brutal-card-static bg-gift-bg">
          <Gift className="w-6 h-6 text-gift" />
          <div>
            <p className="text-xs font-mono uppercase text-muted-foreground">
              Price
            </p>
            <p className="text-2xl font-bold font-mono text-gift">
              {data.cost}
            </p>
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-2">About this gift</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-4">
        {data.amazon_link && (
          <a
            href={data.amazon_link}
            target="_blank"
            rel="noopener noreferrer"
            className="brutal-btn bg-orange-500 inline-flex items-center gap-2 px-4 py-2"
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
            className="brutal-btn inline-flex items-center gap-2 px-4 py-2"
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge className="brutal-badge capitalize">{data.type}</Badge>
        )}
        {data.difficulty && (
          <Badge className="brutal-badge capitalize">{data.difficulty}</Badge>
        )}
        {data.prep_time && (
          <Badge className="brutal-badge flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {data.prep_time}
          </Badge>
        )}
      </div>

      {data.ingredients && data.ingredients.length > 0 && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-3">Ingredients</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.ingredients.map((ingredient, i) => (
              <li
                key={i}
                className="flex items-start gap-2 p-2 bg-secondary border-2 border-border"
              >
                <span className="text-primary font-bold">•</span>
                <span>{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recipe && data.recipe.length > 0 && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-3">Instructions</h3>
          <ol className="space-y-3">
            {data.recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <button
                  onClick={() => toggleStep(i)}
                  className={`shrink-0 w-8 h-8 flex items-center justify-center font-mono font-bold border-2 border-border transition-colors ${
                    completedSteps.has(i)
                      ? "bg-green-500 text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
                <span className="pt-1">{step}</span>
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
          className="flex items-start gap-3 p-4 brutal-card hover:bg-accent"
        >
          <MapPin className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-mono uppercase text-muted-foreground">
              Location
            </p>
            <p className="font-bold">{data.location}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      )}

      {(data.destination_city || data.destination_country) && (
        <div className="flex items-start gap-3 p-4 brutal-card-static">
          <Plane className="w-6 h-6 text-primary" />
          <div>
            <p className="text-xs font-mono uppercase text-muted-foreground">
              Destination
            </p>
            <p className="font-bold">
              {data.destination_city}
              {data.destination_city && data.destination_country && ", "}
              {data.destination_country}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge className="brutal-badge capitalize">{data.type}</Badge>
        )}
        {data.price_range && (
          <Badge className="brutal-badge">{data.price_range}</Badge>
        )}
      </div>

      {data.description && (
        <div>
          <h3 className="text-lg font-bold uppercase mb-2">About</h3>
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
