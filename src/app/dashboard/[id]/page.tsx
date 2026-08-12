"use client";

import { FavoriteButton } from "@/components/favorite-button";
import { TagPills } from "@/components/tag-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContentById, useTags } from "@/hooks/useContent";
import { DEFAULT_TAGS } from "@/lib/constants";
import { isFavorite, saveFavorite } from "@/lib/favorites";
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
  BookmarkPlus,
  Calendar,
  Clock,
  ExternalLink,
  Gift,
  Loader2,
  MapPin,
  Pencil,
  Plane,
  RefreshCw,
  Share2,
  ShoppingCart,
  Trash2,
  XCircle,
  Check,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../useSession";
import { categoryUI } from "@/lib/categories";
import { isImageSourcedItem } from "@/lib/content-source";
import { RecipeSteps } from "./components/RecipeSteps";
import { LocationCard } from "./components/LocationCard";
import { SourcePhotoDialog } from "./components/SourcePhotoDialog";


// Get appropriate link text for the source URL
function getSourceLinkText(url: string): string {
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
  // Content detail is publicly viewable (shareable by link); editing and
  // copying still require a signed-in user.
  const { user, isLoading: sessionLoading } = useSession({
    allowUnauthenticated: true,
  });
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const {
    content,
    tags,
    ownerName,
    isLoading: contentLoading,
    mutate: mutateContent,
  } = useContentById(id);

  const { tags: allTags, mutate: mutateTags } = useTags({ enabled: !!user });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const isEditable = !!user && content?.user_id === user.id;
  const loading = sessionLoading || (contentLoading && !content);

  useEffect(() => {
    if (content) {
      setEditTitle(content.title);
      setEditCategory(content.category);
    }
  }, [content]);

  const handleBack = useCallback(() => {
    // Logged-out visitors (viewing a shared link) can't access the dashboard
    if (!user) {
      router.push("/");
      return;
    }

    const from = searchParams.get("from");
    const week = searchParams.get("week");

    if (from === "planner" && week) {
      router.push(`/dashboard/planner?week=${week}`);
    } else if (from === "home") {
      router.push("/dashboard");
    } else {
      // Items are opened from the collection unless they say otherwise.
      router.push("/dashboard/collection");
    }
  }, [router, searchParams, user]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/dashboard/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: content?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // User cancelled the share sheet or clipboard was unavailable
    }
  }, [id, content?.title]);

  const handleCopyToCollection = async () => {
    setCopying(true);
    setCopyError(null);
    try {
      const res = await fetch(`/api/content/${id}/copy`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save a copy");
      }
      router.push(`/dashboard/${data.content.id}`);
    } catch (error) {
      setCopyError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setCopying(false);
    }
  };

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
        router.push("/dashboard/collection");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!content) return;
    const next = !isFavorite(content);

    // Star the cached item first, without revalidating, so the header responds
    // on the tap rather than after the round trip.
    mutateContent(
      (current) =>
        current && { ...current, content: { ...current.content, is_favorite: next } },
      { revalidate: false }
    );

    // A failed write refetches, which visibly undoes the star.
    if (!(await saveFavorite(id, next))) {
      mutateContent();
    }
  };

  const handleRetryProcessing = async () => {
    if (!content) return;

    setRetrying(true);
    try {
      const res = await fetch(`/api/content/${content.id}/reprocess`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start retry");
      }

      mutateContent();
    } catch (error) {
      console.error("Failed to retry processing:", error);
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
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-medium">Content not found</p>
        </Card>
      </div>
    );
  }

  const config = categoryUI(content.category);
  const Icon = config.icon;

  // A texted-in photo has no page to visit, so its source opens in place. The
  // upload can fail, in which case thumbnail_url is empty and there is nothing
  // to offer.
  const isImageSourced = isImageSourcedItem(content.tiktok_url);
  const sourcePhotoUrl = isImageSourced ? content.thumbnail_url : undefined;

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {content.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                title="Share"
              >
                {linkCopied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </Button>
            )}
            {content.status === "completed" && isEditable && (
              <>
                <FavoriteButton
                  isFavorite={isFavorite(content)}
                  onToggle={handleToggleFavorite}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRetryProcessing}
                  disabled={retrying}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(!editing)}
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
          <Card className="state-processing p-8 text-center mb-8 animate-slide-up">
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
            >
              {retrying ? "..." : "Retry"}
            </Button>
          </Card>
        )}

        {/* Failed State */}
        {content.status === "failed" && (
          <Card className="state-error p-8 text-center mb-8 animate-slide-up">
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
              >
                {retrying ? "..." : "Retry"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="border-destructive text-destructive hover:bg-destructive hover:text-white"
              >
                Delete
              </Button>
            </div>
          </Card>
        )}

        {/* Shared item banner — anyone can view, only the owner can edit */}
        {!isEditable && content.status === "completed" && (
          <Card className="p-4 mb-6 animate-slide-up">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {ownerName ? `Shared by ${ownerName}` : "Shared item"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user
                    ? "Save a copy to your collection to edit it"
                    : "Sign in to save it to your own collection"}
                </p>
              </div>
              {user ? (
                <Button
                  onClick={handleCopyToCollection}
                  disabled={copying}
                >
                  <BookmarkPlus className="w-4 h-4 mr-2" />
                  {copying ? "Saving..." : "Save to my collection"}
                </Button>
              ) : (
                <Button onClick={() => router.push("/")}>
                  Sign In
                </Button>
              )}
            </div>
            {copyError && (
              <p className="text-destructive text-sm mt-2">{copyError}</p>
            )}
          </Card>
        )}

        {/* Main Content Card */}
        <Card className="overflow-hidden animate-slide-up">
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
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="text-sm font-semibold cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meal">Recipe</SelectItem>
                  <SelectItem value="drink">Drink</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="date_idea">Date</SelectItem>
                  <SelectItem value="gift_idea">Gift</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={config.badge}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </Badge>
            )}
          </div>

          <div className="px-6 pt-4 pb-2">
            {editing ? (
              <div className="flex gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-semibold"
                  placeholder="Title"
                />
                <Button onClick={handleSave} disabled={saving}>
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
              <EventContent data={content.data as EventData} title={content.title} />
            )}
            {content.category === "date_idea" && (
              <DateIdeaContent data={content.data as DateIdeaData} title={content.title} />
            )}
            {content.category === "gift_idea" && (
              <GiftIdeaContent data={content.data as GiftIdeaData} />
            )}
            {content.category === "drink" && (
              <DrinkContent data={content.data as DrinkData} />
            )}
            {content.category === "travel" && (
              <TravelContent data={content.data as TravelData} title={content.title} />
            )}
            {content.category === "other" && (
              <OtherContent data={content.data as { description?: string }} />
            )}

            {/* Source */}
            {sourcePhotoUrl && (
              <div className="pt-6 border-t border-[var(--border)]">
                <SourcePhotoDialog
                  imageUrl={sourcePhotoUrl}
                  itemTitle={content.title}
                />
              </div>
            )}

            {!isImageSourced && (
              <div className="pt-6 border-t border-[var(--border)]">
                <Button asChild className="h-auto px-6 py-3">
                  <a
                    href={content.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {getSourceLinkText(content.tiktok_url)}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            )}

            {/* Metadata */}
            <p className="text-sm text-muted-foreground">
              Saved {new Date(content.created_at).toLocaleDateString()}
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}

function MealContent({ data }: { data: MealData }) {
  return (
    <div className="space-y-6">
      <RecipeSteps
        ingredients={data.ingredients}
        recipe={data.recipe}
        variant="meal"
      />

      {(data.prep_time || data.cook_time || data.servings) && (
        <div className="flex flex-wrap gap-3 pt-4">
          {data.prep_time && (
            <Card className="border border-[var(--border)] shadow-none px-4 py-3 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Prep
              </p>
              <p className="font-semibold flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                {data.prep_time}
              </p>
            </Card>
          )}
          {data.cook_time && (
            <Card className="border border-[var(--border)] shadow-none px-4 py-3 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Cook
              </p>
              <p className="font-semibold flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                {data.cook_time}
              </p>
            </Card>
          )}
          {data.servings && (
            <Card className="border border-[var(--border)] shadow-none px-4 py-3 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Servings
              </p>
              <p className="font-semibold mt-1">{data.servings}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function EventContent({ data, title }: { data: EventData; title: string }) {
  return (
    <div className="space-y-4">
      {data.location && (
        <LocationCard location={data.location} label="Location" nickname={title} />
      )}

      {(data.date || data.time) && (
        <Card className="flex items-start gap-4 p-4 border border-[var(--border)] shadow-none rounded-xl">
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
        </Card>
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

function DateIdeaContent({ data, title }: { data: DateIdeaData; title: string }) {
  return (
    <div className="space-y-4">
      {data.location && (
        <LocationCard location={data.location} label="Location" nickname={title} />
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
        <Card className="flex items-start gap-4 p-4 border border-[var(--border)] shadow-none rounded-xl bg-[var(--gift-bg)]">
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
        </Card>
      )}

      {data.description && (
        <div>
          <h3 className="heading-3 mb-2">About this gift</h3>
          <p className="text-muted-foreground">{data.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-4">
        {data.amazon_link && (
          <Button
            asChild
            variant="secondary"
            className="h-auto px-5 py-2.5 bg-orange-500 text-white hover:bg-orange-600"
          >
            <a
              href={data.amazon_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ShoppingCart className="w-4 h-4" />
              Amazon
            </a>
          </Button>
        )}
        {data.purchase_link && (
          <Button asChild className="h-auto px-5 py-2.5">
            <a
              href={data.purchase_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4" />
              Buy Now
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function DrinkContent({ data }: { data: DrinkData }) {
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

      <RecipeSteps
        ingredients={data.ingredients}
        recipe={data.recipe}
        variant="drink"
      />
    </div>
  );
}

function TravelContent({ data, title }: { data: TravelData; title: string }) {
  return (
    <div className="space-y-4">
      {data.location && (
        <LocationCard location={data.location} label="Location" nickname={title} />
      )}

      {(data.destination_city || data.destination_country) && (
        <Card className="flex items-start gap-4 p-4 border border-[var(--border)] shadow-none rounded-xl">
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
        </Card>
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
