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
import { shortDuration } from "@/lib/short-duration";
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
  ChevronRight,
  Calendar,
  CalendarPlus,
  Car,
  Check,
  Clock,
  ExternalLink,
  Gift,
  Globe,
  HelpCircle,
  Loader2,
  MapPin,
  Maximize2,
  MoreVertical,
  Navigation,
  NotebookPen,
  Pencil,
  Plane,
  Play,
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
import useSWR from "swr";
import { fetcher } from "@/lib/swr-config";
import { useSession } from "../useSession";
import { categoryUI } from "@/lib/categories";
import { isImageSourcedItem, isVideoSourceUrl } from "@/lib/content-source";
import { RecipeSteps } from "./components/RecipeSteps";
import { PhotoViewerDialog } from "./components/SourcePhotoDialog";
import { ItemNotes } from "./components/ItemNotes";
import { ContentDataEditor } from "./components/ContentDataEditor";
import { ItemProse, ItemRow, ItemRows } from "./components/ItemRow";
import { AttributeChips } from "./components/AttributeChips";
import { TypeChip } from "@/components/type-chip";
import { PlantDrawer } from "./components/PlantDrawer";
import { SectionEditorDrawer } from "./components/SectionEditorDrawer";
import { toPlannerDateParams } from "@/lib/event-date";
import { displayPrice } from "@/lib/price";

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

/** Square: a portrait thumbnail left a visible well of dead space once tags
 *  came off the page. Tilted in a white border and popping out past the card's
 *  corner, like the photo tucked into a planner card, so the two read as the
 *  same item. */
/** A raised action button, as on the cards (.surface-raised in globals.css). */
const RAISED_BUTTON =
  "surface-raised rounded-full px-3.5 hover:bg-[var(--card)] active:translate-y-px";

const THUMBNAIL_CLASS =
  "relative shrink-0 block w-[138px] h-[138px] rounded-2xl overflow-hidden border-[3px] border-white bg-[var(--muted)] shadow-[var(--shadow-lg)] rotate-[4deg] transition-transform duration-300 ease-out hover:rotate-[7deg] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

/** What sits inside the thumbnail. Shared by the two things it can be — a
 *  button that expands the image, or a link that opens the video — so only the
 *  corner badge says which. */
function ThumbnailBody({
  src,
  alt,
  icon: Icon,
}: {
  src: string;
  alt: string;
  icon: ElementType;
}) {
  return (
    <>
      <Image src={src} alt={alt} fill sizes="138px" className="object-cover" />
      <span className="absolute right-1.5 bottom-1.5 w-[22px] h-[22px] rounded-lg bg-black/55 backdrop-blur-[2px] flex items-center justify-center">
        <Icon className="w-3 h-3 text-white" />
      </span>
    </>
  );
}

/** The bare domain, for a row that shows the link rather than describing it.
 *  "www." is noise nobody reads. */
function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** How the processing poll paces itself: quick at first, because most items
 *  finish in a few seconds, then slower, then not at all. */
const POLL_START_MS = 2000;
const POLL_BACKOFF = 1.5;
const POLL_MAX_MS = 20000;
const POLL_GIVE_UP_MS = 5 * 60 * 1000;

/** Which drawer is open. One at a time, by construction — two stacked sheets on
 *  a phone is a trap you can't back out of. */
type OpenDrawer =
  | { kind: "none" }
  | { kind: "overflow" }
  | { kind: "location"; value: string }
  | { kind: "when" }
  | { kind: "plan" }
  | { kind: "give" }
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
    error: contentError,
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
  // Who a gift was just given to, for the button to say so for a moment.
  const [givenTo, setGivenTo] = useState<string | null>(null);
  const [giving, setGiving] = useState(false);
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

  // The people a gift can go to, fetched only once the picker opens.
  const { data: giveData } = useSWR<{ recipients: { id: string; name: string }[] }>(
    drawer.kind === "give" ? "/api/gifts/recipients" : null,
    fetcher
  );
  const giveRecipients = giveData?.recipients;

  const handleGive = async (recipientId: string, name: string) => {
    if (!content) return;
    setGiving(true);
    try {
      const res = await fetch("/api/gifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, contentId: content.id }),
      });
      if (!res.ok) throw new Error("Failed to add gift");
      setDrawer({ kind: "none" });
      setGivenTo(name);
      setTimeout(() => setGivenTo(null), 2500);
    } catch (error) {
      console.error("Failed to give gift:", error);
    } finally {
      setGiving(false);
    }
  };

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

  /**
   * Watch an item while it is being processed.
   *
   * A fixed 3s interval with no way out logged 129 requests for one item in six
   * minutes — and kept going after the row had been deleted, because
   * `keepPreviousData` holds the last good response, so the status never stops
   * reading "processing" and the loop never notices the 404s.
   *
   * So: back off as the wait gets longer, stop once the request starts failing,
   * and give up entirely after five minutes. Processing that has not finished
   * by then is not going to, and the page has a Regenerate button for that.
   */
  useEffect(() => {
    if (content?.status !== "processing") return;
    if (contentError) return;

    let timer: ReturnType<typeof setTimeout>;
    let delay = POLL_START_MS;
    const startedAt = Date.now();

    const tick = () => {
      if (Date.now() - startedAt > POLL_GIVE_UP_MS) return;
      mutateContent();
      delay = Math.min(delay * POLL_BACKOFF, POLL_MAX_MS);
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [content?.status, contentError, mutateContent]);

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
  const starred = isFavorite(content);

  // A texted-in photo has no page to visit, so there is no "open the source"
  // link for it — the thumbnail is the source.
  const isImageSourced = isImageSourcedItem(content.tiktok_url);

  // A video's thumbnail is a still pulled out of the post, so expanding it
  // full-screen gives you a frame of the thing you actually wanted to watch.
  // Tapping it plays the post instead, which also means the row of buttons at
  // the foot of the page has nothing left to offer.
  const thumbnailPlaysSource =
    !!content.thumbnail_url && isVideoSourceUrl(content.tiktok_url);

  const eventData = content.data as EventData;
  const eventWhen = [eventData.date, eventData.time].filter(Boolean).join(" · ");
  const ticketLink =
    content.category === "event" ? eventData.ticket_link : undefined;
  const reservationLink =
    content.category === "event" ? eventData.reservation_link : undefined;
  const plannerQuery = toPlannerDateParams(eventData.date);
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

        {/* Not overflow-hidden: the thumbnail pops out past the card's top
            corner, so the tinted header rounds its own top instead. */}
        <Card className="animate-slide-up">
          {/* The header — title, thumbnail, chips — takes the category's tint;
              everything below stays on the card's white. */}
          <div className={`rounded-t-2xl ${editing ? "" : config.bg}`}>
            {editing ? (
              <div className="px-4 pt-4 pb-3">
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
                ) : null}
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-semibold mt-2"
                  placeholder="Title"
                  aria-label="Title"
                />
              </div>
            ) : (
              // Hero: the thumbnail floats right and the title and chips flow
              // around it, so a short title doesn't leave a well of space
              // while the chips wait for the photo to end. (The image used to
              // be a 320px banner; demoting it puts the facts first.) flow-root
              // keeps the float inside the hero.
              <div className="flow-root px-4 pt-4">
                {content.thumbnail_url && (
                  <div className="relative float-right ml-3.5 mb-2 -mt-8 -mr-5">
                {content.thumbnail_url &&
                  (thumbnailPlaysSource ? (
                    <a
                      href={content.tiktok_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={THUMBNAIL_CLASS}
                      aria-label={getSourceLinkText(content.tiktok_url)}
                    >
                      <ThumbnailBody
                        src={content.thumbnail_url}
                        alt={content.title}
                        icon={Play}
                      />
                    </a>
                  ) : (
                    /* The thumbnail is the trigger, so Radix returns focus here
                       when the viewer closes. */
                    <PhotoViewerDialog
                      open={photoOpen}
                      onOpenChange={setPhotoOpen}
                      imageUrl={content.thumbnail_url}
                      itemTitle={content.title}
                      title={content.title}
                      trigger={
                        <button
                          type="button"
                          className={THUMBNAIL_CLASS}
                          aria-label="View full size"
                        >
                          <ThumbnailBody
                            src={content.thumbnail_url}
                            alt={content.title}
                            icon={Maximize2}
                          />
                        </button>
                      }
                    />
                  ))}
                  </div>
                )}

                {/* A line over the title for what to read first: whose item
                    this is, when it isn't yours; an event's when. */}
                {!isEditable && content.status === "completed" && (
                  <p className="mb-1 text-[13px] font-semibold text-muted-foreground">
                    {ownerName ? `Shared by ${ownerName}` : "Shared with you"}
                  </p>
                )}
                {content.category === "event" &&
                  eventWhen &&
                  (isEditable ? (
                    // The one place the date shows: tapping it does what the
                    // date row below the header used to.
                    <button
                      type="button"
                      onClick={() => setDrawer({ kind: "when" })}
                      className={`mb-1 inline-flex items-center gap-0.5 rounded-md text-[13px] font-semibold ${config.text} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
                    >
                      {eventWhen}
                      <ChevronRight className="size-3.5" />
                    </button>
                  ) : (
                    <p className={`mb-1 text-[13px] font-semibold ${config.text}`}>
                      {eventWhen}
                    </p>
                  ))}
                {/* No category pill: the tint says what kind of item this is,
                    and the icon leading the chips names it. */}
                <h1 className="heading-2">{content.title}</h1>

                {/* Attributes sit directly under the title — the at-a-glance
                    answer to "is this the one for tonight". */}
                <AttributeChips
                  category={content.category}
                  data={content.data as Record<string, unknown>}
                  onShowPlants={
                    plants.length > 0
                      ? () => setDrawer({ kind: "plants" })
                      : undefined
                  }
                  leading={
                    <TypeChip
                      category={content.category}
                      className="px-2.5 py-1.5 align-middle text-[12.5px] [&>svg]:size-[15px]"
                    />
                  }
                  className="px-0 pt-3"
                />
              </div>
            )}

            {!editing &&
              (content.category === "meal" || content.category === "drink") && (
                <RecipeStats
                  prep={mealData.prep_time}
                  cook={mealData.cook_time}
                  servings={mealData.servings}
                />
              )}

            {/* The page's own actions, up where they're seen — they lived
                only in the overflow menu, and the item's links (tickets) and
                the shared-item save sat apart at the foot of the page or in a
                card of their own. Raised, like every button on the cards; the
                first is the one this item is for, in the primary colour. Not a
                bar pinned to the screen's foot: the tab bar already lives
                there, sliding in and out with the scroll. */}
            {!editing && content.status === "completed" && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {ticketLink && (
                    <Button asChild variant="ghost" size="sm" className={`${RAISED_BUTTON} text-[var(--primary)] hover:text-[var(--primary)]`}>
                      <a href={ticketLink} target="_blank" rel="noopener noreferrer">
                        <Ticket className="size-4" />
                        Tickets
                      </a>
                    </Button>
                  )}
                  {reservationLink && (
                    <Button asChild variant="ghost" size="sm" className={RAISED_BUTTON}>
                      <a href={reservationLink} target="_blank" rel="noopener noreferrer">
                        <Calendar className="size-4" />
                        Reserve
                      </a>
                    </Button>
                  )}
                  {isEditable &&
                    (content.category === "gift_idea" ? (
                      // A gift is planned for a person, not a day.
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDrawer({ kind: "give" })}
                        className={`${RAISED_BUTTON} ${
                          ticketLink ? "" : "text-[var(--primary)] hover:text-[var(--primary)]"
                        }`}
                      >
                        {givenTo ? <Check className="size-4" /> : <Gift className="size-4" />}
                        {givenTo ? `Added for ${givenTo}` : "Give to someone"}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDrawer({ kind: "plan" })}
                        className={`${RAISED_BUTTON} ${
                          ticketLink ? "" : "text-[var(--primary)] hover:text-[var(--primary)]"
                        }`}
                      >
                        <CalendarPlus className="size-4" />
                        Add to planner
                      </Button>
                    ))}
                  {!isEditable &&
                    (user ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyToCollection}
                        disabled={copying}
                        className={`${RAISED_BUTTON} text-[var(--primary)] hover:text-[var(--primary)]`}
                      >
                        <BookmarkPlus className="size-4" />
                        {copying ? "Saving…" : "Save to my collection"}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/")}
                        className={`${RAISED_BUTTON} text-[var(--primary)] hover:text-[var(--primary)]`}
                      >
                        <BookmarkPlus className="size-4" />
                        Sign in to save
                      </Button>
                    ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    className={RAISED_BUTTON}
                  >
                    {linkCopied ? (
                      <Check className="size-4" />
                    ) : (
                      <Share2 className="size-4" />
                    )}
                    {linkCopied ? "Link copied" : "Share"}
                  </Button>
                </div>
                {copyError && (
                  <p className="text-destructive text-sm mt-2" role="alert">
                    {copyError}
                  </p>
                )}
              </div>
            )}
          </div>

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
                    // A quiet link at the end of the content rather than a
                    // dashed box in the middle of it: editing is the rarer
                    // thing to do here than reading.
                    className="mt-1 mb-3 mx-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-muted-foreground transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add section
                  </button>
                )}

                {/* Only for sources the thumbnail doesn't already open: a
                    texted-in photo has no page to visit, and a video post is
                    reached by tapping its still. */}
                {!isImageSourced && !thumbnailPlaysSource && (
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
        {/* Offered only when we actually know which day that is. It used to be
            offered always and fall back to the plain planner, so an event
            whose date we could not read answered "go to this day" by landing
            on today — which reads as the button being broken. */}
        {plannerQuery && (
          <DrawerItem
            icon={Calendar}
            onClick={() => {
              closeDrawer();
              router.push(`/dashboard/planner?${plannerQuery}`);
            }}
          >
            Go to this day in the planner
          </DrawerItem>
        )}
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
        open={drawer.kind === "give"}
        onOpenChange={closeDrawer}
        title="Give to someone"
        description={
          giveRecipients && giveRecipients.length === 0
            ? "Add the people you buy for on the Gifts page first."
            : "Pick who this gift is for."
        }
      >
        <div className="pb-2">
          {giveRecipients === undefined ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">
              Loading…
            </p>
          ) : giveRecipients.length === 0 ? (
            <DrawerItem
              icon={Gift}
              onClick={() => {
                closeDrawer();
                router.push("/dashboard/gifts");
              }}
            >
              Go to Gifts
            </DrawerItem>
          ) : (
            giveRecipients.map((recipient) => (
              <DrawerItem
                key={recipient.id}
                icon={Gift}
                disabled={giving}
                onClick={() => handleGive(recipient.id, recipient.name)}
              >
                {recipient.name}
              </DrawerItem>
            ))
          )}
        </div>
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

/**
 * Prep, cook and servings as a row of figures in the header, the way recipe
 * apps lead with them. They'd been demoted to a quiet line under the
 * ingredients, which is past where anyone deciding "tonight?" has stopped
 * reading. Pressed in, as information is on these cards.
 */
function RecipeStats({
  prep,
  cook,
  servings,
}: {
  prep?: string;
  cook?: string;
  servings?: string;
}) {
  const stats = [
    { label: "Prep", value: prep && shortDuration(prep) },
    { label: "Cook", value: cook && shortDuration(cook) },
    { label: "Serves", value: servings },
  ].filter((stat): stat is { label: string; value: string } => !!stat.value);

  if (stats.length === 0) return null;

  return (
    <dl className="surface-inset mx-4 mb-3 grid grid-flow-col auto-cols-fr rounded-2xl px-1 py-2.5 text-center">
      {stats.map((stat) => (
        <div key={stat.label} className="px-2">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            {stat.label}
          </dt>
          <dd className="mt-0.5 text-[14px] font-semibold leading-tight">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
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
 * `website` is not among them — it now rides in a row of its own next to the
 * address, which is where a reader looks for it.
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
  // The date and the ticket/reserve links aren't here: the date sits over the
  // title (tapping it opens what this row used to), and the links are in the
  // header's action row.
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

      {/* The site is a fact about the place, not an afterthought — it used to
          be a lone button below the description, far from the address it
          belongs with. */}
      {data.website && (
        <ItemRow
          icon={Globe}
          iconClassName="text-muted-foreground"
          href={data.website}
        >
          {getDomainLabel(data.website)}
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

      {data.description && (
        <ItemProse icon={HelpCircle} label="About">
          {data.description}
        </ItemProse>
      )}
      </ItemRows>
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

      {/* The site is a fact about the place, not an afterthought — it used to
          be a lone button below the description, far from the address it
          belongs with. */}
      {data.website && (
        <ItemRow
          icon={Globe}
          iconClassName="text-muted-foreground"
          href={data.website}
        >
          {getDomainLabel(data.website)}
        </ItemRow>
      )}

      {/* Tag, not Star — a star means "favourited" everywhere else in the app,
          and this row is just the type and price. */}
      {(data.type || displayPrice(data.price_range)) && (
        <ItemRow icon={Tag} iconClassName="text-[var(--date)]">
          <span className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="date" className="capitalize">
                {data.type}
              </Badge>
            )}
            {displayPrice(data.price_range) && (
              <Badge variant="outline">{displayPrice(data.price_range)}</Badge>
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
      {/* No price row: the price chip in the header already says it. */}
      <ItemRows>
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

  // A booked stay reads as a span; a place merely saved has one date or none.
  const when = data.end_date
    ? `${data.date} – ${data.end_date}`
    : data.date || "";

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

      {/* The site is a fact about the place, not an afterthought — it used to
          be a lone button below the description, far from the address it
          belongs with. */}
      {data.website && (
        <ItemRow
          icon={Globe}
          iconClassName="text-muted-foreground"
          href={data.website}
        >
          {getDomainLabel(data.website)}
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

      {when && (
        <ItemRow icon={Clock} iconClassName="text-[var(--event)]">
          {when}
        </ItemRow>
      )}

      {(data.type || displayPrice(data.price_range)) && (
        <ItemRow icon={Tag} iconClassName="text-muted-foreground">
          <span className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="travel" className="capitalize">
                {data.type}
              </Badge>
            )}
            {displayPrice(data.price_range) && (
              <Badge variant="outline">{displayPrice(data.price_range)}</Badge>
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
