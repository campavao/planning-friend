"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  Content,
  MealData,
  EventData,
  DateIdeaData,
  GiftIdeaData,
  TravelData,
  DrinkData,
  Tag,
} from "@/lib/supabase";
import { TagPills } from "@/components/tag-pills";
import { DEFAULT_TAGS } from "@/lib/constants";

// Generate Google Maps URL from location string
function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

export default function ContentDetailPage() {
  const [content, setContent] = useState<Content | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

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
        body: JSON.stringify({ title: editTitle }),
      });

      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-shimmer w-16 h-16 rounded-full" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Content not found</p>
      </div>
    );
  }

  const categoryConfig: Record<
    string,
    { emoji: string; label: string; color: string }
  > = {
    meal: { emoji: "🍽️", label: "Meal", color: "badge-meal" },
    drink: { emoji: "🍹", label: "Drink", color: "badge-drink" },
    event: { emoji: "🎉", label: "Event", color: "badge-event" },
    date_idea: { emoji: "💕", label: "Date Idea", color: "badge-date_idea" },
    gift_idea: { emoji: "🎁", label: "Gift Idea", color: "badge-gift_idea" },
    travel: { emoji: "✈️", label: "Travel", color: "badge-travel" },
    other: { emoji: "📌", label: "Saved", color: "badge-other" },
  };

  const config = categoryConfig[content.category] || categoryConfig.other;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            ← Back
          </Button>
          <div className="flex gap-2">
            {content.status === "completed" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Cancel" : "Edit"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Processing State */}
        {content.status === "processing" && (
          <div className="glass rounded-2xl p-8 text-center mb-8 animate-pulse">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-semibold mb-2">Processing...</h2>
            <p className="text-muted-foreground">
              Analyzing your TikTok video. This usually takes 10-30 seconds.
            </p>
          </div>
        )}

        {/* Failed State */}
        {content.status === "failed" && (
          <div className="glass rounded-2xl p-8 text-center mb-8 border-destructive/50">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-semibold mb-2">Processing Failed</h2>
            <p className="text-muted-foreground mb-4">
              We couldn&apos;t analyze this video. You can delete it and try
              again.
            </p>
          </div>
        )}

        {/* Main Content Card */}
        <Card className="glass overflow-hidden">
          {content.thumbnail_url && (
            <div className="relative h-64 md:h-80">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <Badge
                className={`absolute top-4 right-4 ${config.color} border`}
              >
                {config.emoji} {config.label}
              </Badge>
            </div>
          )}

          <CardHeader>
            {editing ? (
              <div className="flex gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold"
                />
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <CardTitle className="text-2xl md:text-3xl">
                {content.title}
              </CardTitle>
            )}

            {/* Tags Section */}
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Tags</p>
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
          </CardHeader>

          <CardContent className="space-y-6">
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

            {/* Link to TikTok */}
            <div className="pt-4 border-t border-border">
              <a
                href={content.tiktok_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Watch on TikTok →
              </a>
            </div>

            {/* Metadata */}
            <p className="text-sm text-muted-foreground">
              Saved on {new Date(content.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
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
