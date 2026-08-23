"use client";

import type { ElementType } from "react";
import { upcomingDays } from "@/lib/plan-dates";
import { describeDaysSince, type PlanHistorySummary } from "@/lib/plan-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ActionDrawer,
  DrawerItem,
  DrawerLink,
  DrawerSeparator,
} from "@/components/ui/action-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContentById, usePlanHistory } from "@/hooks/useContent";
import { NOTE_COMPOSER_PARAM, NOTE_COMPOSER_VALUE } from "@/lib/constants";
import { isFavorite, saveFavorite } from "@/lib/favorites";
import { getGoogleMapsUrl, getUberUrl } from "@/lib/map-links";
import { readPlants } from "@/lib/plants";
import type {
  ContentCategory,
  CustomSection,
  DateIdeaData,
  DrinkData,
  EventData,
  GiftIdeaData,
  MealData,
  TravelData,
} from "@/lib/supabase";
import { diffContentData, hasManualEdits } from "@/lib/schemas/content";
import {
  ArrowLeft,
  BookmarkPlus,
  Calendar,
  CalendarPlus,
  Car,
  Check,
  Clock,
  ExternalLink,
  Gift,
  HelpCircle,
  Info,
  Loader2,
  MapPin,
  Maximize2,
  MoreVertical,
  Navigation,
  NotebookPen,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Share2,
  ShoppingCart,
  Star,
  Tag,
  Ticket,
  Trash2,
  Utensils,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../useSession";
import { categoryUI } from "@/lib/categories";
import { isImageSourcedItem } from "@/lib/content-source";
import { RecipeSteps } from "./components/RecipeSteps";
import { PhotoViewerDialog } from "./components/SourcePhotoDialog";
import { ItemNotes } from "./components/ItemNotes";
import { ContentDataEditor } from "./components/ContentDataEditor";
import { ItemProse, ItemRow, ItemRows } from "./components/ItemRow";
import { AttributeChips } from "./components/AttributeChips";
import { PlantDrawer } from "./components/PlantDrawer";
import { SectionEditorDrawer } from "./components/SectionEditorDrawer";
import { toPlannerDateParams } from "@/lib/event-date";

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

/** Which drawer is open. One at a time, by construction — two stacked sheets on
 *  a phone is a trap you can't back out of. */
type OpenDrawer =
  | { kind: "none" }
  | { kind: "overflow" }
  | { kind: "location"; value: string }
  | { kind: "when" }
  | { kind: "plan" }
  | { kind: "eating" }
  | { kind: "notes" }
  | { kind: "plants" }
  | { kind: "section"; index: number | null };

/**
 * What the planner knows about this item.
 *
 * Sits above the notes, since both answer "have I had this, and how was it".
 * Renders nothing at all when the item has never been planned — a row reading
 * "planned 0 times" is worse than silence, because it takes up space to say
 * the reader already knows.
 */
function PlanHistoryRow({ summary }: { summary: PlanHistorySummary }) {
  const { timesPlanned, daysSince, lastPlanned, nextPlanned, usualDay } =
    summary;

  if (timesPlanned === 0 && !nextPlanned) return null;

  const lastDate = lastPlanned
    ? new Date(lastPlanned).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : null;

  const nextDate = nextPlanned
    ? new Date(nextPlanned).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="px-2 pt-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
            In your planner
          </p>
        </div>

        {daysSince !== null && lastDate && (
          <p className="text-[13px] font-medium">
            {describeDaysSince(daysSince)}
            <span className="text-muted-foreground font-normal">
              {" · "}
              {lastDate}
            </span>
          </p>
        )}

        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {timesPlanned > 0 && (
            <>
              Planned {timesPlanned} {timesPlanned === 1 ? "time" : "times"}
              {usualDay && `, usually on a ${usualDay}`}.
            </>
          )}
          {nextDate && (
            <>
              {timesPlanned > 0 ? " " : ""}
              Coming up {nextDate}.
            </>
          )}
        </p>
      </div>
    </div>
  );
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
    ownerName,
    isLoading: contentLoading,
    mutate: mutateContent,
  } = useContentById(id);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  // The working copy of the category-specific blob, plus the snapshot it was
  // seeded from — the save sends the difference between the two, never the
  // whole thing.
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [editBaseline, setEditBaseline] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<OpenDrawer>({ kind: "none" });
  const [planningDay, setPlanningDay] = useState<string | null>(null);
  const [plannedLabel, setPlannedLabel] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const isEditable = !!user && content?.user_id === user.id;

  // Owner-only: the endpoint refuses anyone else, so a shared view never asks.
  const { history: planHistory, mutate: mutatePlanHistory } = usePlanHistory(
    id,
    { enabled: isEditable }
  );
  const loading = sessionLoading || (contentLoading && !content);

  const closeDrawer = useCallback(() => setDrawer({ kind: "none" }), []);

  // The note reminder deep-links here with the composer already open, so the
  // push can be acted on in one tap.
  const openNoteComposer =
    searchParams.get(NOTE_COMPOSER_PARAM) === NOTE_COMPOSER_VALUE;

  // Seeding is skipped while the form is open: a background revalidation would
  // otherwise reset half-typed edits back to what the server still holds.
  useEffect(() => {
    if (!content || editing) return;

    setEditTitle(content.title);
    setEditCategory(content.category);

    const snapshot = { ...(content.data as Record<string, unknown>) };
    setEditData(snapshot);
    setEditBaseline(snapshot);
  }, [content, editing]);

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

  useEffect(() => {
    if (content?.status !== "processing") return;

    const interval = setInterval(() => {
      mutateContent();
    }, 3000);

    return () => clearInterval(interval);
  }, [content?.status, mutateContent]);

  /** Persist a `data` patch straight away, outside edit mode. Custom sections
   *  are edited in place rather than through the form, so they need this. */
  const patchData = useCallback(
    async (patch: Record<string, unknown>) => {
      const res = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: patch }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to save");
      }
      mutateContent();
    },
    [id, mutateContent]
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        title: editTitle,
        category: editCategory,
      };

      // Only the keys the user actually changed travel; the route merges them
      // over what is stored, so anything this editor never showed — an older
      // extraction's fields, an image URL — is left exactly as it was.
      const dataPatch = diffContentData(editBaseline, editData);
      if (Object.keys(dataPatch).length > 0) {
        body.data = dataPatch;
      }

      const res = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to save");
      }

      mutateContent();
      setEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setSaveError(null);
    // Dropping out of edit mode lets the seeding effect restore the form from
    // the item as it is stored, which is what makes this a real cancel.
    setEditing(false);
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

  /**
   * Put this item on a day.
   *
   * Sends `plannedDate` and lets the server derive the week from it. The client
   * has a user-configurable week start (Sunday or Monday) while the stored plan
   * is always Monday-based, so computing weekStart here would be a second
   * opinion on a question the server already answers correctly.
   */
  const handleAddToPlanner = async (date: Date, label: string) => {
    if (!content) return;
    const key = date.toISOString();
    setPlanningDay(key);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          plannedDate: key,
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setPlannedLabel(label);
      // The "coming up" line is now stale by exactly the thing just added.
      mutatePlanHistory();
      // Left open briefly so the confirmation is actually seen; planning two
      // days in a row is common enough that closing instantly would annoy.
      setTimeout(() => {
        setPlannedLabel(null);
        setDrawer({ kind: "none" });
      }, 1400);
    } catch (error) {
      console.error("Failed to add to planner:", error);
      setPlannedLabel("Could not add — try again");
      setTimeout(() => setPlannedLabel(null), 2500);
    } finally {
      setPlanningDay(null);
    }
  };

  const handleToggleFavorite = async () => {
    if (!content) return;
    const next = !isFavorite(content);

    // Star the cached item first, without revalidating, so the header responds
    // on the tap rather than after the round trip.
    mutateContent(
      (current) =>
        current && {
          ...current,
          content: { ...current.content, is_favorite: next },
        },
      { revalidate: false }
    );

    // A failed write refetches, which visibly undoes the star.
    if (!(await saveFavorite(id, next))) {
      mutateContent();
    }
  };

  const handleRetryProcessing = async () => {
    if (!content) return;

    // Re-processing re-rolls the whole item from its source, so a hand-edited
    // ingredient list is gone the moment it finishes. Say so before starting —
    // but only for an item that has details to lose; retrying one that is stuck
    // or failed stays a single tap.
    if (content.status === "completed") {
      const warning = hasManualEdits(content.data)
        ? "Re-processing reads the original source again and replaces everything here, including the edits you made by hand. Continue?"
        : "Re-processing reads the original source again and replaces the details on this item. Continue?";
      if (!confirm(warning)) return;
    }

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

  const data = (content?.data ?? {}) as Record<string, unknown>;
  const sections = useMemo(
    () => (Array.isArray(data.sections) ? (data.sections as CustomSection[]) : []),
    [data.sections]
  );

  const saveSection = async (next: CustomSection, index: number | null) => {
    const updated = [...sections];
    if (index === null) updated.push(next);
    else updated[index] = next;
    await patchData({ sections: updated });
  };

  const removeSection = async (index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    // An empty array still clears the list: applyContentDataPatch writes it as
    // an empty array rather than removing the key, which reads the same.
    await patchData({ sections: updated });
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
  const starred = isFavorite(content);

  // A texted-in photo has no page to visit, so there is no "open the source"
  // link for it — the thumbnail is the source.
  const isImageSourced = isImageSourcedItem(content.tiktok_url);

  const eventData = content.data as EventData;
  const mealData = content.data as MealData;
  const plants = readPlants(mealData.plants);

  const locationValue =
    drawer.kind === "location" ? drawer.value : undefined;

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header — one overflow menu, not five buttons. Star stays outside it
          because starring is a single tap you do often. */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <div className="flex items-center gap-1">
            {content.status === "completed" && isEditable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleFavorite}
                aria-pressed={starred}
                title={starred ? "Starred" : "Star"}
              >
                <Star
                  className={
                    starred
                      ? "w-[19px] h-[19px] fill-[var(--accent)] text-[var(--accent)]"
                      : "w-[19px] h-[19px]"
                  }
                />
              </Button>
            )}
            {content.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawer({ kind: "overflow" })}
                title="More"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
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
              <Button onClick={handleRetryProcessing} disabled={retrying}>
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
                <Button onClick={handleCopyToCollection} disabled={copying}>
                  <BookmarkPlus className="w-4 h-4 mr-2" />
                  {copying ? "Saving..." : "Save to my collection"}
                </Button>
              ) : (
                <Button onClick={() => router.push("/")}>Sign In</Button>
              )}
            </div>
            {copyError && (
              <p className="text-destructive text-sm mt-2">{copyError}</p>
            )}
          </Card>
        )}

        <Card className="overflow-hidden animate-slide-up">
          {/* Hero — title block left, thumbnail right. The image used to be a
              320px banner above the fold; demoting it puts the facts first,
              which is what people open a saved item for. Tags are deliberately
              not shown: they still exist on the item, but the structured rows
              below are what this view is now organised around. */}
          <div className="flex gap-3.5 px-4 pt-4 pb-3 items-start">
            <div className="flex-1 min-w-0">
              {editing ? (
                // Changing the category leaves `data` alone — see the reasoning
                // in PATCH /api/content/[id]. The fields below simply swap to
                // the new shape, and anything the new shape doesn't show is
                // still there if the category is switched back.
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="text-sm font-semibold cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meal">Recipe</SelectItem>
                    <SelectItem value="drink">Drink</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="date_idea">Restaurant</SelectItem>
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

              {editing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-semibold mt-2"
                  placeholder="Title"
                  aria-label="Title"
                />
              ) : (
                <h1 className="heading-2 mt-2">{content.title}</h1>
              )}
            </div>

            {/* The thumbnail is the trigger, so Radix returns focus here when
                the viewer closes. */}
            {content.thumbnail_url && !editing && (
              <PhotoViewerDialog
                open={photoOpen}
                onOpenChange={setPhotoOpen}
                imageUrl={content.thumbnail_url}
                itemTitle={content.title}
                title={content.title}
                trigger={
                  <button
                    type="button"
                    // Square, and no taller than the title block beside it.
                    // A portrait thumbnail left a visible well of dead space
                    // once tags came off the page and the text column got
                    // short.
                    className="relative shrink-0 w-[92px] h-[92px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--muted)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    aria-label="View full size"
                  >
                    <Image
                      src={content.thumbnail_url}
                      alt={content.title}
                      fill
                      sizes="92px"
                      className="object-cover"
                    />
                    <span className="absolute right-1.5 bottom-1.5 w-[22px] h-[22px] rounded-lg bg-black/55 backdrop-blur-[2px] flex items-center justify-center">
                      <Maximize2 className="w-3 h-3 text-white" />
                    </span>
                  </button>
                }
              />
            )}
          </div>

          {/* Attributes sit directly under the title — they are the
              at-a-glance answer to "is this the one for tonight". Every
              category now gets them; the component renders nothing for an item
              whose fields are all absent. */}
          {!editing && (
            <AttributeChips
              category={content.category}
              data={content.data as Record<string, unknown>}
              onShowPlants={
                plants.length > 0
                  ? () => setDrawer({ kind: "plants" })
                  : undefined
              }
            />
          )}

          <div className="px-2 pb-6">
            {editing ? (
              <div className="px-2 space-y-6">
                <ContentDataEditor
                  category={editCategory as ContentCategory}
                  data={editData}
                  onChange={setEditData}
                />

                {saveError && (
                  <p className="text-destructive text-sm" role="alert">
                    {saveError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {content.category === "meal" &&
                  (hasNoRecipe(mealData) ? (
                    <NoRecipeNotice sourceUrl={content.tiktok_url} />
                  ) : (
                    <MealContent data={mealData} />
                  ))}
                {content.category === "event" && (
                  <EventContent
                    data={eventData}
                    onOpen={setDrawer}
                    canPlan={isEditable}
                  />
                )}
                {content.category === "date_idea" && (
                  <DateIdeaContent
                    data={content.data as DateIdeaData}
                    onOpen={setDrawer}
                  />
                )}
                {content.category === "gift_idea" && (
                  <GiftIdeaContent data={content.data as GiftIdeaData} />
                )}
                {content.category === "drink" &&
                  (hasNoRecipe(content.data as DrinkData) ? (
                    <NoRecipeNotice sourceUrl={content.tiktok_url} />
                  ) : (
                    <DrinkContent data={content.data as DrinkData} />
                  ))}
                {content.category === "travel" && (
                  <TravelContent
                    data={content.data as TravelData}
                    onOpen={setDrawer}
                  />
                )}
                {content.category === "other" && (
                  <OtherContent data={content.data as { description?: string }} />
                )}

                {/* Owner-defined rows, rendered exactly like the extracted
                    ones so nothing feels bolted on. */}
                {sections.length > 0 && (
                  <ItemRows>
                    {sections.map((section, index) => (
                      <ItemRow
                        key={`${section.label}-${index}`}
                        icon={Ticket}
                        iconClassName="text-[var(--date)]"
                        label={section.label}
                        onClick={
                          isEditable
                            ? () => setDrawer({ kind: "section", index })
                            : undefined
                        }
                      >
                        {section.value}
                      </ItemRow>
                    ))}
                  </ItemRows>
                )}

                {isEditable && content.status === "completed" && (
                  <button
                    type="button"
                    onClick={() => setDrawer({ kind: "section", index: null })}
                    className="mt-2 mb-4 mx-2 flex items-center gap-2 px-3 py-2.5 w-[calc(100%-1rem)] rounded-2xl border border-dashed border-[var(--border-strong)] text-[13.5px] font-semibold text-muted-foreground transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Plus className="w-4 h-4" />
                    Add section
                  </button>
                )}

                {/* A texted-in photo has no page to visit — its source is the
                    thumbnail above, which already expands to the full image,
                    so there is no second button for it here. */}
                {!isImageSourced && (
                  <div className="px-2 pt-4 mt-2 border-t border-[var(--border)]">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-auto py-3"
                    >
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

                {isEditable && planHistory && (
                  <PlanHistoryRow summary={planHistory} />
                )}

                {/* Notes — the owner's record of how it actually went. Private,
                    so a shared link never shows them. */}
                {isEditable && content.status === "completed" && (
                  <div className="px-2">
                    <ItemNotes
                      contentId={content.id}
                      autoOpenComposer={openNoteComposer}
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground px-2 pt-5">
                  Saved {new Date(content.created_at).toLocaleDateString()}
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ---- drawers ---- */}

      <ActionDrawer
        open={drawer.kind === "overflow"}
        onOpenChange={closeDrawer}
        title={content.title}
      >
        <DrawerItem icon={linkCopied ? Check : Share2} onClick={handleShare}>
          {linkCopied ? "Link copied" : "Share"}
        </DrawerItem>
        {isEditable && (
          <>
            <DrawerItem
              icon={CalendarPlus}
              onClick={() => setDrawer({ kind: "plan" })}
            >
              Add to planner
            </DrawerItem>
            <DrawerItem
              icon={Star}
              onClick={handleToggleFavorite}
              hint={starred ? "Starred" : undefined}
            >
              {starred ? "Remove star" : "Star"}
            </DrawerItem>
            <DrawerItem
              icon={RefreshCw}
              disabled={retrying}
              onClick={() => {
                closeDrawer();
                handleRetryProcessing();
              }}
            >
              Regenerate
            </DrawerItem>
            <DrawerItem
              icon={Pencil}
              onClick={() => {
                closeDrawer();
                setEditing(true);
              }}
            >
              Edit
            </DrawerItem>
            <DrawerSeparator />
            <DrawerItem
              icon={Trash2}
              destructive
              disabled={deleting}
              onClick={() => {
                closeDrawer();
                handleDelete();
              }}
            >
              Delete
            </DrawerItem>
          </>
        )}
      </ActionDrawer>

      <ActionDrawer
        open={drawer.kind === "location"}
        onOpenChange={closeDrawer}
        title={locationValue ?? "Location"}
      >
        {locationValue && (
          <>
            <DrawerLink
              icon={Navigation}
              href={getGoogleMapsUrl(locationValue)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps
            </DrawerLink>
            <DrawerLink
              icon={Car}
              href={getUberUrl(locationValue, content.title)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ride with Uber
            </DrawerLink>
          </>
        )}
      </ActionDrawer>

      <ActionDrawer
        open={drawer.kind === "when"}
        onOpenChange={closeDrawer}
        title={[eventData.date, eventData.time].filter(Boolean).join(" · ")}
      >
        <DrawerItem
          icon={Calendar}
          onClick={() => {
            closeDrawer();
            const query = toPlannerDateParams(eventData.date);
            router.push(
              query ? `/dashboard/planner?${query}` : "/dashboard/planner"
            );
          }}
        >
          Go to this day in the planner
        </DrawerItem>
        <DrawerItem
          icon={CalendarPlus}
          onClick={() => {
            closeDrawer();
            router.push("/dashboard/planner");
          }}
        >
          Add to a different day
        </DrawerItem>
      </ActionDrawer>

      <ActionDrawer
        open={drawer.kind === "plan"}
        onOpenChange={closeDrawer}
        title={plannedLabel ? `Added to ${plannedLabel}` : "Add to planner"}
        description={
          plannedLabel ? undefined : "Pick a day. You can move it later."
        }
      >
        <div className="pb-2">
          {upcomingDays().map(({ date, label, sub }) => {
            const key = date.toISOString();
            return (
              <DrawerItem
                key={key}
                icon={CalendarPlus}
                hint={sub}
                disabled={planningDay !== null}
                onClick={() => handleAddToPlanner(date, `${label} · ${sub}`)}
              >
                {label}
              </DrawerItem>
            );
          })}
        </div>
      </ActionDrawer>

      <ActionDrawer
        open={drawer.kind === "eating"}
        onOpenChange={closeDrawer}
        title="Eating here"
      >
        <DrawerItem
          icon={Utensils}
          hint="from collection"
          onClick={() => {
            closeDrawer();
            router.push("/dashboard/planner");
          }}
        >
          Add a meal item
        </DrawerItem>
        <DrawerItem
          icon={NotebookPen}
          onClick={() => {
            closeDrawer();
            router.push("/dashboard/planner");
          }}
        >
          Add a quick note
        </DrawerItem>
      </ActionDrawer>

      <PlantDrawer
        open={drawer.kind === "plants"}
        onOpenChange={closeDrawer}
        plants={plants}
      />

      <SectionEditorDrawer
        open={drawer.kind === "section"}
        onOpenChange={closeDrawer}
        section={
          drawer.kind === "section" && drawer.index !== null
            ? sections[drawer.index]
            : undefined
        }
        onSave={(next) =>
          saveSection(next, drawer.kind === "section" ? drawer.index : null)
        }
        onRemove={
          drawer.kind === "section" && drawer.index !== null
            ? () => removeSection(drawer.index as number)
            : undefined
        }
      />

    </main>
  );
}

/** Prep/cook/servings, demoted to one quiet line. They were three cards at the
 *  top; they are useful to know and not useful enough to lead with. */
function RecipeFacts({
  prep,
  cook,
  servings,
}: {
  prep?: string;
  cook?: string;
  servings?: string;
}) {
  const parts = [
    prep && `${prep} prep`,
    cook && `${cook} cook`,
    servings && `Serves ${servings}`,
  ].filter(Boolean) as string[];

  if (parts.length === 0) return null;

  return (
    <p className="flex items-center gap-1.5 px-2 pt-3 text-[12.5px] font-medium text-muted-foreground">
      <Clock className="w-3.5 h-3.5" />
      {parts.join(" · ")}
    </p>
  );
}

/**
 * Shown when a recipe item holds no recipe.
 *
 * Some items genuinely arrive empty: a source that blocks us, or an extraction
 * that came back with nothing. Until now those rendered as a title and blank
 * space, which reads as the app being broken rather than as the source being
 * unreadable. Saying so — and pointing at the original, which still works —
 * turns a bug report into a bookmark.
 *
 * Deliberately not an error state. Nothing failed just now, and there is
 * nothing for the reader to retry.
 */
function NoRecipeNotice({ sourceUrl }: { sourceUrl?: string }) {
  return (
    <div className="px-2 py-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3.5">
        <p className="text-[13px] font-semibold mb-1">No recipe saved</p>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          We couldn&apos;t read the recipe from this post — some sources block
          us. The original still has it.
        </p>
        {sourceUrl && (
          <Button
            asChild
            variant="secondary"
            className="mt-3 h-auto px-4 py-2 text-[12.5px]"
          >
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" />
              Open the original
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** True when a recipe item carries neither ingredients nor steps. */
function hasNoRecipe(data: MealData | DrinkData): boolean {
  return !data.ingredients?.length && !data.recipe?.length;
}

function MealContent({ data }: { data: MealData }) {
  return (
    <div className="px-2">
      <RecipeSteps
        ingredients={data.ingredients}
        recipe={data.recipe}
        equipment={data.equipment}
        variant="meal"
      />
      <RecipeFacts
        prep={data.prep_time}
        cook={data.cook_time}
        servings={data.servings}
      />
    </div>
  );
}

/**
 * The links an item carries, as buttons.
 *
 * These fields were being extracted, validated, stored and shown in the editor,
 * and then never rendered on the item itself — only the two gift links were.
 * So a saved event with a ticket link, or a restaurant with a menu, looked as
 * though the extraction had found nothing.
 *
 * `website` is first because it is the catch-all: a post that just puts its
 * domain on the last slide has no more specific field to land in.
 */
function LinkButtons({
  links,
}: {
  links: { href?: string; label: string; icon: ElementType }[];
}) {
  const present = links.filter((link) => link.href);
  if (present.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 pt-3">
      {present.map(({ href, label, icon: Icon }) => (
        <Button
          key={label}
          asChild
          variant="secondary"
          className="h-auto px-5 py-2.5"
        >
          <a href={href} target="_blank" rel="noopener noreferrer">
            <Icon className="w-4 h-4" />
            {label}
          </a>
        </Button>
      ))}
    </div>
  );
}

function EventContent({
  data,
  onOpen,
  canPlan,
}: {
  data: EventData;
  onOpen: (drawer: OpenDrawer) => void;
  canPlan: boolean;
}) {
  const when = [data.date, data.time].filter(Boolean).join(" · ");

  return (
    <>
      <ItemRows>
      {data.location && (
        <ItemRow
          icon={MapPin}
          iconClassName="text-[var(--primary)]"
          onClick={() => onOpen({ kind: "location", value: data.location! })}
        >
          {data.location}
        </ItemRow>
      )}

      {when && (
        <ItemRow
          icon={Clock}
          iconClassName="text-[var(--event)]"
          onClick={canPlan ? () => onOpen({ kind: "when" }) : undefined}
        >
          {when}
        </ItemRow>
      )}

      {canPlan && (
        <ItemRow
          icon={Utensils}
          iconClassName="text-[var(--meal)]"
          meta="Add a meal or a note for this outing"
          onClick={() => onOpen({ kind: "eating" })}
        >
          Eating here
        </ItemRow>
      )}

      {data.seats && (
        <ItemRow icon={Ticket} iconClassName="text-[var(--date)]" label="Seats">
          {data.seats}
        </ItemRow>
      )}

      {/* Info, not Ticket — the seats row above already owns that icon, and
          two identical icons in one list read as one repeated fact. */}
      {(data.requires_reservation || data.requires_ticket) && (
        <ItemRow icon={Info} iconClassName="text-muted-foreground">
          <span className="flex flex-wrap gap-2">
            {data.requires_reservation && (
              <Badge variant="outline">Reservation required</Badge>
            )}
            {data.requires_ticket && (
              <Badge variant="outline">Ticket required</Badge>
            )}
          </span>
        </ItemRow>
      )}

      {data.description && (
        <ItemProse icon={HelpCircle} label="About">
          {data.description}
        </ItemProse>
      )}
      </ItemRows>
      <LinkButtons
        links={[
          { href: data.website, label: "Website", icon: ExternalLink },
          { href: data.ticket_link, label: "Tickets", icon: Ticket },
          { href: data.reservation_link, label: "Reserve", icon: Calendar },
        ]}
      />
    </>
  );
}

function DateIdeaContent({
  data,
  onOpen,
}: {
  data: DateIdeaData;
  onOpen: (drawer: OpenDrawer) => void;
}) {
  return (
    <>
      <ItemRows>
      {data.location && (
        <ItemRow
          icon={MapPin}
          iconClassName="text-[var(--primary)]"
          onClick={() => onOpen({ kind: "location", value: data.location! })}
        >
          {data.location}
        </ItemRow>
      )}

      {/* Tag, not Star — a star means "favourited" everywhere else in the app,
          and this row is just the type and price. */}
      {(data.type || data.price_range) && (
        <ItemRow icon={Tag} iconClassName="text-[var(--date)]">
          <span className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="date" className="capitalize">
                {data.type}
              </Badge>
            )}
            {data.price_range && (
              <Badge variant="outline">{data.price_range}</Badge>
            )}
          </span>
        </ItemRow>
      )}

      {data.description && (
        <ItemProse icon={HelpCircle} label="Why it&apos;s great">
          {data.description}
        </ItemProse>
      )}
      </ItemRows>
      <LinkButtons
        links={[
          { href: data.website, label: "Website", icon: ExternalLink },
          { href: data.menu_link, label: "Menu", icon: Utensils },
          { href: data.reservation_link, label: "Reserve", icon: Calendar },
        ]}
      />
    </>
  );
}

function GiftIdeaContent({ data }: { data: GiftIdeaData }) {
  return (
    <>
      <ItemRows>
        {data.cost && (
          <ItemRow icon={Gift} iconClassName="text-[var(--gift)]" label="Price">
            {data.cost}
          </ItemRow>
        )}
        {data.description && (
          <ItemProse icon={HelpCircle} label="About this gift">
            {data.description}
          </ItemProse>
        )}
      </ItemRows>

      {(data.amazon_link || data.purchase_link) && (
        <div className="flex flex-wrap gap-2 px-2 pt-3">
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
                Buy now
              </a>
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function DrinkContent({ data }: { data: DrinkData }) {
  return (
    <div className="px-2">
      {(data.type || data.difficulty || data.prep_time) && (
        <div className="flex flex-wrap gap-2 pb-3">
          {data.type && (
            <Badge variant="drink" className="capitalize">
              {data.type}
            </Badge>
          )}
          {data.difficulty && (
            <Badge variant="outline" className="capitalize">
              {data.difficulty}
            </Badge>
          )}
          {data.prep_time && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {data.prep_time}
            </Badge>
          )}
        </div>
      )}

      <RecipeSteps
        ingredients={data.ingredients}
        recipe={data.recipe}
        equipment={data.equipment}
        variant="drink"
      />

      {data.description && (
        <p className="text-[13.5px] leading-relaxed text-muted-foreground pt-3">
          {data.description}
        </p>
      )}
    </div>
  );
}

function TravelContent({
  data,
  onOpen,
}: {
  data: TravelData;
  onOpen: (drawer: OpenDrawer) => void;
}) {
  const destination = [data.destination_city, data.destination_country]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <ItemRows>
      {data.location && (
        <ItemRow
          icon={MapPin}
          iconClassName="text-[var(--primary)]"
          onClick={() => onOpen({ kind: "location", value: data.location! })}
        >
          {data.location}
        </ItemRow>
      )}

      {destination && (
        <ItemRow
          icon={Plane}
          iconClassName="text-[var(--travel)]"
          label="Destination"
        >
          {destination}
        </ItemRow>
      )}

      {(data.type || data.price_range) && (
        <ItemRow icon={Tag} iconClassName="text-muted-foreground">
          <span className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="travel" className="capitalize">
                {data.type}
              </Badge>
            )}
            {data.price_range && (
              <Badge variant="outline">{data.price_range}</Badge>
            )}
          </span>
        </ItemRow>
      )}

      {data.description && (
        <ItemProse icon={HelpCircle} label="About">
          {data.description}
        </ItemProse>
      )}
      </ItemRows>
      <LinkButtons
        links={[
          { href: data.website, label: "Website", icon: ExternalLink },
          { href: data.booking_link, label: "Book", icon: Calendar },
        ]}
      />
    </>
  );
}

function OtherContent({ data }: { data: { description?: string } }) {
  if (!data.description) return null;
  return (
    <ItemRows>
      <ItemProse icon={HelpCircle} label="About">
        {data.description}
      </ItemProse>
    </ItemRows>
  );
}
