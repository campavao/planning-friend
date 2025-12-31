"use client";

import { TagPills } from "@/components/tag-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_TAGS } from "@/lib/constants";
import type {
  Content,
  DateIdeaData,
  DrinkData,
  EventData,
  GiftIdeaData,
  MealData,
  Tag,
  TravelData,
} from "@/lib/supabase";
import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../useSession";

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
  // Image-only content has no external link
  if (isImageOnlyContent(url)) {
    return null;
  }
  if (
    url.includes("tiktok.com") ||
    url.includes("vm.tiktok.com") ||
    url.includes("vt.tiktok.com")
  ) {
    return "Watch on TikTok →";
  }
  if (url.includes("instagram.com") || url.includes("instagr.am")) {
    return "View on Instagram →";
  }
  // Generic website
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return `Visit ${hostname} →`;
  } catch {
    return "Visit Website →";
  }
}

export default function ContentDetailPage() {
  const { user } = useSession();
  const [content, setContent] = useState<Content | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
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
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isEditable = content?.user_id === user?.id;

  // Determine back navigation based on where user came from
  const handleBack = useCallback(() => {
    const from = searchParams.get("from");
    const week = searchParams.get("week");

    if (from === "planner" && week) {
      // Navigate back to planner with the same week
      router.push(`/dashboard/planner?week=${week}`);
    } else {
      // Default to dashboard
      router.push("/dashboard");
    }
  }, [router, searchParams]);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/${id}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/");
          return;
        }
        throw new Error(data.error);
      }

      setContent(data.content);
      setEditTitle(data.content.title);
      setEditCategory(data.content.category);
      if (data.tags) {
        setTags(data.tags);
      }
    } catch (error) {
      console.error("Failed to fetch content:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchAllTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    }
  }, []);

  const handleAddTag = async (name: string) => {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contentId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags((prev) => [...prev, data.tag]);
        fetchAllTags();
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
        const tag = allTags.find((t) => t.id === tagId);
        if (tag) {
          setTags((prev) => [...prev, tag]);
        }
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
        setTags((prev) => prev.filter((t) => t.id !== tagId));
      }
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  useEffect(() => {
    fetchContent();
    fetchAllTags();

    // Poll for updates if processing
    const interval = setInterval(() => {
      if (content?.status === "processing") {
        fetchContent();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchContent, fetchAllTags, content?.status]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, category: editCategory }),
      });

      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setEditCategory(data.content.category);
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
        message: "Retry started. We'll keep this page updated.",
      });
      await fetchContent();
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
      <div className='min-h-screen flex items-center justify-center bg-paper'>
        <div className='animate-shimmer w-16 h-16 rounded-full' />
      </div>
    );
  }

  if (!content) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-paper'>
        <p className='font-handwritten text-xl'>Content not found</p>
      </div>
    );
  }

  const categoryConfig: Record<
    string,
    { emoji: string; label: string; color: string; sticker: string }
  > = {
    meal: {
      emoji: "🍽️",
      label: "Recipe",
      color: "badge-meal",
      sticker: "sticker-meal",
    },
    drink: {
      emoji: "🍹",
      label: "Drink",
      color: "badge-drink",
      sticker: "sticker-drink",
    },
    event: {
      emoji: "🎉",
      label: "Event",
      color: "badge-event",
      sticker: "sticker-event",
    },
    date_idea: {
      emoji: "💕",
      label: "Date Idea",
      color: "badge-date_idea",
      sticker: "sticker-date_idea",
    },
    gift_idea: {
      emoji: "🎁",
      label: "Gift Idea",
      color: "badge-gift_idea",
      sticker: "sticker-gift_idea",
    },
    travel: {
      emoji: "✈️",
      label: "Travel",
      color: "badge-travel",
      sticker: "sticker-travel",
    },
    other: {
      emoji: "📌",
      label: "Saved",
      color: "badge-other",
      sticker: "sticker-other",
    },
  };

  const config = categoryConfig[content.category] || categoryConfig.other;

  return (
    <main className='min-h-screen pb-28 md:pb-8 bg-paper'>
      {/* Scrapbook Header */}
      <div className='pt-6 pb-4 px-4 md:px-6'>
        <div className='max-w-4xl mx-auto flex items-center justify-between'>
          <Button
            variant='ghost'
            onClick={handleBack}
            className='hover:bg-washi-mint/20'
          >
            ← Back
          </Button>
          <div className='flex gap-2'>
            {content.status === "completed" && isEditable && (
              <>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleRetryProcessing}
                  disabled={retrying}
                  className='mt-1 hover:bg-washi-yellow/40'
                >
                  {retrying ? "Retrying..." : "Try Reprocessing"}
                </Button>
                {retryFeedback?.type === "success" && (
                  <p className='text-sm text-muted-foreground mt-2'>
                    {retryFeedback.message}
                  </p>
                )}
                {retryFeedback?.type === "error" && (
                  <p className='text-sm text-destructive mt-2'>
                    {retryFeedback.message}
                  </p>
                )}
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setEditing(!editing)}
                  className='hover:bg-washi-blue/20'
                >
                  {editing ? "Cancel" : "✏️ Edit"}
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleDelete}
                  disabled={deleting}
                  className='text-destructive hover:text-destructive hover:bg-destructive/10'
                >
                  {deleting ? "..." : "🗑️"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className='max-w-4xl mx-auto px-4'>
        {/* Processing State */}
        {content.status === "processing" && (
          <div className='scrapbook-card p-8 text-center mb-8 relative'>
            <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-washi-yellow/80 transform -rotate-1' />
            <div className='text-6xl mb-4 animate-wiggle pt-2'>✂️</div>
            <h2 className='font-handwritten text-2xl mb-2'>Clipping...</h2>
            <p className='text-muted-foreground mb-4'>
              Processing this for you. Almost done!
            </p>
            <Button
              variant='secondary'
              size='sm'
              onClick={handleRetryProcessing}
              disabled={retrying}
              className='mt-1 hover:bg-washi-yellow/40'
            >
              {retrying ? "Retrying..." : "Try Reprocessing"}
            </Button>
            {retryFeedback?.type === "success" && (
              <p className='text-sm text-muted-foreground mt-2'>
                {retryFeedback.message}
              </p>
            )}
            {retryFeedback?.type === "error" && (
              <p className='text-sm text-destructive mt-2'>
                {retryFeedback.message}
              </p>
            )}
            <Button
              variant='ghost'
              size='sm'
              onClick={handleDelete}
              disabled={deleting}
              className='text-muted-foreground hover:text-destructive'
            >
              {deleting ? "Cancelling..." : "Cancel"}
            </Button>
          </div>
        )}

        {/* Failed State */}
        {content.status === "failed" && (
          <div className='scrapbook-card p-8 text-center mb-8 border-destructive/20 relative'>
            <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-5 bg-washi-coral/80 transform rotate-1' />
            <div className='text-6xl mb-4 pt-2'>😕</div>
            <h2 className='font-handwritten text-2xl mb-2'>Oops!</h2>
            <p className='text-muted-foreground mb-4'>
              We couldn&apos;t process this link.
            </p>
            <Button
              variant='secondary'
              size='sm'
              onClick={handleRetryProcessing}
              disabled={retrying}
              className='mt-1 hover:bg-washi-yellow/40'
            >
              {retrying ? "Retrying..." : "Try Reprocessing"}
            </Button>
            {retryFeedback?.type === "success" && (
              <p className='text-sm text-muted-foreground mt-2'>
                {retryFeedback.message}
              </p>
            )}
            {retryFeedback?.type === "error" && (
              <p className='text-sm text-destructive mt-2'>
                {retryFeedback.message}
              </p>
            )}
            <Button
              variant='outline'
              onClick={handleDelete}
              disabled={deleting}
              className='text-destructive border-destructive/30 hover:bg-destructive/10'
            >
              {deleting ? "Deleting..." : "🗑️ Delete & Try Again"}
            </Button>
          </div>
        )}

        {/* Main Content Card - Polaroid style */}
        <div className='scrapbook-card overflow-hidden relative'>
          {/* Washi tape decorations */}
          <div className='absolute -top-2 left-8 w-16 h-5 bg-washi-mint/80 transform -rotate-2 z-10' />
          <div className='absolute -top-2 right-12 w-14 h-5 bg-washi-pink/80 transform rotate-1 z-10' />

          {content.thumbnail_url && (
            <div className='p-3 pt-6 pb-0'>
              <div className='relative h-56 md:h-72 overflow-hidden rounded bg-muted'>
                <Image
                  src={content.thumbnail_url}
                  alt={content.title}
                  fill
                  className='object-cover'
                />
              </div>
            </div>
          )}

          {/* Sticker badge / Category selector */}
          <div className='px-4 pt-3'>
            {editing ? (
              <div className='relative inline-block'>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className='text-sm pl-4 pr-10 py-2 rounded-full bg-white border border-border font-medium cursor-pointer appearance-none'
                >
                  <option value='meal'>🍽️ Recipe</option>
                  <option value='drink'>🍹 Drink</option>
                  <option value='event'>🎉 Event</option>
                  <option value='date_idea'>💕 Date Idea</option>
                  <option value='gift_idea'>🎁 Gift Idea</option>
                  <option value='travel'>✈️ Travel</option>
                  <option value='other'>📌 Other</option>
                </select>
                <span className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs'>
                  <ChevronDownIcon className='w-4 h-4' />
                </span>
              </div>
            ) : (
              <span
                className={`sticker ${config.sticker} text-xs inline-block`}
              >
                {config.emoji} {config.label}
              </span>
            )}
          </div>

          <div className='px-4 pt-3 pb-2'>
            {editing ? (
              <div className='flex gap-2'>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className='text-xl font-bold bg-white border-border'
                  placeholder='Title'
                />
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className='bg-primary hover:bg-primary/90'
                >
                  {saving ? "..." : "Save"}
                </Button>
              </div>
            ) : (
              <h1 className='text-xl md:text-2xl font-semibold'>
                {content.title}
              </h1>
            )}

            {/* Tags Section */}
            {isEditable && (
              <div className='mt-4'>
                <p className='text-sm text-muted-foreground mb-2 font-handwritten'>
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

          <div className='px-4 pb-4 space-y-6'>
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

            {/* Link to original content (not shown for image-only content) */}
            {!isImageOnlyContent(content.tiktok_url) && (
              <div className='pt-4 border-t border-border'>
                <a
                  href={content.tiktok_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                >
                  {getSourceLinkText(content.tiktok_url)}
                </a>
              </div>
            )}

            {/* Metadata */}
            <p className='text-sm text-muted-foreground'>
              Saved on {new Date(content.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function MealContent({ data }: { data: MealData }) {
  return (
    <div className="space-y-6">
      {data.ingredients && data.ingredients.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Ingredients</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.ingredients.map((ingredient, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recipe && data.recipe.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Instructions</h3>
          <ol className="space-y-3">
            {data.recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-sm">
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(data.prep_time || data.cook_time || data.servings) && (
        <div className="flex flex-wrap gap-4 pt-4">
          {data.prep_time && (
            <div className="glass rounded-lg px-4 py-2">
              <p className="text-xs text-muted-foreground">Prep Time</p>
              <p className="font-medium">{data.prep_time}</p>
            </div>
          )}
          {data.cook_time && (
            <div className="glass rounded-lg px-4 py-2">
              <p className="text-xs text-muted-foreground">Cook Time</p>
              <p className="font-medium">{data.cook_time}</p>
            </div>
          )}
          {data.servings && (
            <div className="glass rounded-lg px-4 py-2">
              <p className="text-xs text-muted-foreground">Servings</p>
              <p className="font-medium">{data.servings}</p>
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
          className="flex items-start gap-3 group hover:bg-secondary/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
        >
          <span className="text-2xl">📍</span>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium group-hover:text-primary underline decoration-dotted underline-offset-2">
              {data.location}
            </p>
          </div>
          <span className="text-muted-foreground ml-auto text-sm group-hover:text-primary">
            Open in Maps →
          </span>
        </a>
      )}

      {(data.date || data.time) && (
        <div className="flex items-start gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-sm text-muted-foreground">When</p>
            <p className="font-medium">
              {data.date}
              {data.date && data.time && " at "}
              {data.time}
            </p>
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="text-lg font-semibold mb-2">About</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.requires_reservation && (
          <Badge variant="outline">🎫 Reservation Required</Badge>
        )}
        {data.requires_ticket && (
          <Badge variant="outline">🎟️ Ticket Required</Badge>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3 pt-2">
        {data.website && (
          <a
            href={data.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            🌐 Website
          </a>
        )}
        {data.reservation_link && (
          <a
            href={data.reservation_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            🎫 Make Reservation
          </a>
        )}
        {data.ticket_link && (
          <a
            href={data.ticket_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            🎟️ Get Tickets
          </a>
        )}
      </div>
    </div>
  );
}

function DateIdeaContent({ data }: { data: DateIdeaData }) {
  const typeEmoji: Record<string, string> = {
    dinner: "🍷",
    activity: "🎯",
    entertainment: "🎭",
    outdoors: "🌲",
    other: "💡",
  };

  return (
    <div className="space-y-4">
      {data.location && (
        <a
          href={getGoogleMapsUrl(data.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 group hover:bg-secondary/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
        >
          <span className="text-2xl">📍</span>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium group-hover:text-primary underline decoration-dotted underline-offset-2">
              {data.location}
            </p>
          </div>
          <span className="text-muted-foreground ml-auto text-sm group-hover:text-primary">
            Open in Maps →
          </span>
        </a>
      )}

      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge variant="outline">
            {typeEmoji[data.type] || "💡"}{" "}
            {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
          </Badge>
        )}
        {data.price_range && (
          <Badge variant="outline">{data.price_range}</Badge>
        )}
      </div>

      {data.description && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Why it&apos;s great</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-3 pt-2">
        {data.website && (
          <a
            href={data.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            🌐 Website
          </a>
        )}
        {data.menu_link && (
          <a
            href={data.menu_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            📋 Menu
          </a>
        )}
        {data.reservation_link && (
          <a
            href={data.reservation_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            🎫 Make Reservation
          </a>
        )}
      </div>
    </div>
  );
}

function GiftIdeaContent({ data }: { data: GiftIdeaData }) {
  return (
    <div className="space-y-4">
      {data.cost && (
        <div className="flex items-start gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="font-medium text-xl text-gift">{data.cost}</p>
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="text-lg font-semibold mb-2">About this gift</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      {/* Purchase Links */}
      <div className="flex flex-wrap gap-3 pt-4">
        {data.amazon_link && (
          <a
            href={data.amazon_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
          >
            🛒 View on Amazon
          </a>
        )}
        {data.purchase_link && (
          <a
            href={data.purchase_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            🛍️ Buy Now
          </a>
        )}
      </div>
    </div>
  );
}

function DrinkContent({ data }: { data: DrinkData }) {
  const typeEmoji: Record<string, string> = {
    cocktail: "🍸",
    mocktail: "🍹",
    coffee: "☕",
    smoothie: "🥤",
    wine: "🍷",
    beer: "🍺",
    other: "🥃",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge variant="outline">
            {typeEmoji[data.type] || "🥃"}{" "}
            {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
          </Badge>
        )}
        {data.difficulty && (
          <Badge variant="outline">
            {data.difficulty === "easy" && "✅"}
            {data.difficulty === "medium" && "⚡"}
            {data.difficulty === "hard" && "🔥"}{" "}
            {data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1)}
          </Badge>
        )}
        {data.prep_time && <Badge variant="outline">⏱️ {data.prep_time}</Badge>}
      </div>

      {data.ingredients && data.ingredients.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Ingredients</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.ingredients.map((ingredient, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recipe && data.recipe.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Instructions</h3>
          <ol className="space-y-3">
            {data.recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-sm">
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className="text-lg font-semibold mb-2">About</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}
    </div>
  );
}

function TravelContent({ data }: { data: TravelData }) {
  const typeEmoji: Record<string, string> = {
    restaurant: "🍽️",
    attraction: "🏛️",
    hotel: "🏨",
    activity: "🎯",
    other: "📍",
  };

  return (
    <div className="space-y-4">
      {data.location && (
        <a
          href={getGoogleMapsUrl(data.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 group hover:bg-secondary/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
        >
          <span className="text-2xl">📍</span>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium group-hover:text-primary underline decoration-dotted underline-offset-2">
              {data.location}
            </p>
          </div>
          <span className="text-muted-foreground ml-auto text-sm group-hover:text-primary">
            Open in Maps →
          </span>
        </a>
      )}

      {(data.destination_city || data.destination_country) && (
        <div className="flex items-start gap-3">
          <span className="text-2xl">🌍</span>
          <div>
            <p className="text-sm text-muted-foreground">Destination</p>
            <p className="font-medium">
              {data.destination_city}
              {data.destination_city && data.destination_country && ", "}
              {data.destination_country}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.type && (
          <Badge variant="outline">
            {typeEmoji[data.type] || "📍"}{" "}
            {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
          </Badge>
        )}
        {data.price_range && (
          <Badge variant="outline">{data.price_range}</Badge>
        )}
      </div>

      {data.description && (
        <div>
          <h3 className="text-lg font-semibold mb-2">About</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-3 pt-2">
        {data.website && (
          <a
            href={data.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            🌐 Website
          </a>
        )}
        {data.booking_link && (
          <a
            href={data.booking_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            📅 Book Now
          </a>
        )}
      </div>
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
