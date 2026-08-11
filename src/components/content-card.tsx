"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FavoriteButton } from "@/components/favorite-button";
import { isFavorite } from "@/lib/favorites";
import type {
  Content,
  ContentWithTags,
  DateIdeaData,
  DrinkData,
  EventData,
  GiftIdeaData,
  MealData,
  Tag,
  TravelData,
} from "@/lib/supabase";
import {
  Clock,
  Loader2,
  MapPin,
  Plane,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { categoryUI } from "@/lib/categories";
import { useSlideIn } from "@/hooks/useSlideIn";

const SLIDE_IN_GROUP = "content-card";

/** Animation props for a card, or nothing once the group has already played. */
function slideInProps(play: boolean, index: number) {
  return play
    ? {
        className: "animate-slide-up",
        style: { animationDelay: `${Math.min(index, 5) * 0.1}s` },
      }
    : { className: "", style: undefined };
}

// Generate Google Maps URL from location string
export function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

// Clickable location component
function LocationLink({ location }: { location: string }) {
  return (
    <a
      href={getGoogleMapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--primary)] transition-colors"
    >
      <MapPin className="w-3 h-3" />
      <span className="line-clamp-1 underline underline-offset-2">
        {location}
      </span>
    </a>
  );
}

interface ContentCardProps {
  content: Content | ContentWithTags;
  index?: number;
  tags?: Tag[];
  /**
   * Where the card navigates. Defaults to the item's detail page; pass null to
   * render an unlinked card (a planner quick note has no content row behind it).
   */
  href?: string | null;
  /** Replaces the category's own meta line — e.g. a planned time. */
  meta?: React.ReactNode;
  /**
   * Renders the star. Left off wherever the item isn't the viewer's to star:
   * the planner shows friends' shared items through this same card.
   */
  onToggleFavorite?: (next: boolean) => void;
}

/** Resolve the card's destination: undefined means "the usual detail page". */
function resolveHref(content: Content, href?: string | null): string | null {
  return href === undefined ? `/dashboard/${content.id}` : href;
}

function CardLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (href === null) return <>{children}</>;
  return <Link href={href}>{children}</Link>;
}

function ProcessingCard({
  content,
  index = 0,
}: {
  content: Content;
  index?: number;
}) {
  const [retryState, setRetryState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [retryMessage, setRetryMessage] = useState("");

  const handleRetry = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setRetryState("pending");
    setRetryMessage("");

    try {
      const res = await fetch(`/api/content/${content.id}/reprocess`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start retry");
      }

      setRetryState("success");
      setRetryMessage("Retrying...");
    } catch (error) {
      setRetryState("error");
      setRetryMessage(
        error instanceof Error ? error.message : "Something went wrong"
      );
    }
  };

  const isRetrying = retryState === "pending";
  const slide = slideInProps(useSlideIn(SLIDE_IN_GROUP), index);

  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card
        className={`overflow-hidden cursor-pointer h-full hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] ${slide.className}`}
        style={slide.style}
      >
        <div className="aspect-square bg-[var(--accent-light)] flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
            <p className="text-sm font-medium text-[var(--accent-foreground)]">
              Processing
            </p>
          </div>
        </div>
        <div className="p-4">
          <p className="font-semibold text-sm mb-2">Adding...</p>
          <div className="loading-bar" />
          <Button
            variant="secondary"
            size="sm"
            className="w-full mt-3 text-xs"
            onClick={handleRetry}
            disabled={isRetrying || retryState === "success"}
          >
            {retryState === "success"
              ? "Sent!"
              : isRetrying
                ? "..."
                : "Retry"}
          </Button>
          {retryState === "error" && (
            <p className="text-[10px] text-destructive mt-1">
              {retryMessage}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

function FailedCard({
  content,
  index = 0,
}: {
  content: Content;
  index?: number;
}) {
  const slide = slideInProps(useSlideIn(SLIDE_IN_GROUP), index);

  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card
        className={`overflow-hidden cursor-pointer h-full hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] state-error ${slide.className}`}
        style={slide.style}
      >
        <div className="aspect-square bg-red-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-destructive" />
            </div>
            <p className="text-sm font-medium text-destructive">
              Failed
            </p>
          </div>
        </div>
        <div className="p-4">
          <p className="font-semibold text-sm">Error</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tap to retry
          </p>
        </div>
      </Card>
    </Link>
  );
}

function ContentCardInner({
  content,
  tags,
  index = 0,
  meta,
  href,
  onToggleFavorite,
}: {
  content: Content;
  tags?: Tag[];
  index?: number;
  meta?: React.ReactNode;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  const { icon: Icon, label, badge: badgeVariant } = categoryUI(
    content.category
  );
  const slide = slideInProps(useSlideIn(SLIDE_IN_GROUP), index);
  const starred = isFavorite(content);
  const star = onToggleFavorite ? (
    <FavoriteButton
      isFavorite={starred}
      onToggle={() => onToggleFavorite(!starred)}
      variant="overlay"
    />
  ) : null;

  return (
    <CardLink href={resolveHref(content, href)}>
      <Card
        className={`overflow-hidden cursor-pointer h-full hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] ${slide.className}`}
        style={slide.style}
      >
        {/* Image. Items without one — quick notes, anything whose thumbnail
            didn't come through — drop the block entirely rather than show a
            placeholder, and carry their category badge inline instead. */}
        {content.thumbnail_url && (
          <div className="relative">
            <div className="relative aspect-square overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Category badge overlay */}
            <div className="absolute top-3 left-3">
              <Badge variant={badgeVariant} className="shadow-sm">
                <Icon className="w-3 h-3" />
                {label}
              </Badge>
            </div>

            {star && <div className="absolute top-3 right-3">{star}</div>}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Without a photo there's no overlay to sit in, so the badge row
              carries the star instead. */}
          {!content.thumbnail_url && (
            <div className="flex items-center justify-between gap-2 mb-2 -mr-1.5">
              <Badge variant={badgeVariant}>
                <Icon className="w-3 h-3" />
                {label}
              </Badge>
              {star}
            </div>
          )}
          <h3 className="font-semibold text-sm line-clamp-2 leading-snug mb-1">
            {content.title}
          </h3>

          {meta && (
            <div className="mt-2 text-muted-foreground">{meta}</div>
          )}
        </div>
      </Card>
    </CardLink>
  );
}

function MealCard({
  content,
  data,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  data: MealData;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        <div className="hidden md:flex flex-wrap gap-2 text-xs">
          {data.ingredients && data.ingredients.length > 0 && (
            <span className="text-muted-foreground">{data.ingredients.length} ingredients</span>
          )}
          {data.prep_time && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {data.prep_time}
            </span>
          )}
        </div>
      }
    />
  );
}

function DrinkCard({
  content,
  data,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  data: DrinkData;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        <div className="hidden md:flex flex-wrap gap-2 text-xs">
          {data.ingredients && data.ingredients.length > 0 && (
            <span className="text-muted-foreground">{data.ingredients.length} ingredients</span>
          )}
          {data.type && <span className="capitalize text-muted-foreground">{data.type}</span>}
        </div>
      }
    />
  );
}

function EventCard({
  content,
  data,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  data: EventData;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        <div className="hidden md:block space-y-1 text-xs">
          {data.location && <LocationLink location={data.location} />}
          {data.date && (
            <p className="text-muted-foreground">
              {data.date} {data.time && `• ${data.time}`}
            </p>
          )}
        </div>
      }
    />
  );
}

function DateIdeaCard({
  content,
  data,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  data: DateIdeaData;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        <div className="hidden md:block space-y-1 text-xs">
          {data.location && <LocationLink location={data.location} />}
          {data.price_range && (
            <p className="text-muted-foreground">{data.price_range}</p>
          )}
        </div>
      }
    />
  );
}

function GiftIdeaCard({
  content,
  data,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  data: GiftIdeaData;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        data.cost && (
          <p className="text-sm font-semibold text-[var(--gift)]">{data.cost}</p>
        )
      }
    />
  );
}

function TravelCard({
  content,
  data,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  data: TravelData;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        <div className="hidden md:block space-y-1 text-xs">
          {data.location && <LocationLink location={data.location} />}
          {data.destination_country && (
            <p className="flex items-center gap-1 text-muted-foreground">
              <Plane className="w-3 h-3" />
              {data.destination_city && `${data.destination_city}, `}
              {data.destination_country}
            </p>
          )}
        </div>
      }
    />
  );
}

function OtherCard({
  content,
  tags,
  index = 0,
  href,
  onToggleFavorite,
}: {
  content: Content;
  tags?: Tag[];
  index?: number;
  href?: string | null;
  onToggleFavorite?: (next: boolean) => void;
}) {
  const data = content.data as { description?: string };

  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        data.description && (
          <p className="hidden md:block text-xs line-clamp-2 text-muted-foreground">
            {data.description}
          </p>
        )
      }
    />
  );
}

export function ContentCard({
  content,
  index = 0,
  tags,
  href,
  meta,
  onToggleFavorite,
}: ContentCardProps) {
  // Get tags from content if it's ContentWithTags, or use provided tags
  const contentTags = tags || ("tags" in content ? content.tags : undefined);

  // Handle processing and failed states
  if (content.status === "processing") {
    return <ProcessingCard content={content} index={index} />;
  }

  if (content.status === "failed") {
    return <FailedCard content={content} index={index} />;
  }

  // An explicit meta replaces the per-category one, so callers like the
  // planner can show a planned time in the same slot.
  if (meta !== undefined) {
    return (
      <ContentCardInner
        content={content}
        tags={contentTags}
        index={index}
        href={href}
        onToggleFavorite={onToggleFavorite}
        meta={meta}
      />
    );
  }

  switch (content.category) {
    case "meal":
      return (
        <MealCard
          content={content}
          data={content.data as MealData}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
    case "drink":
      return (
        <DrinkCard
          content={content}
          data={content.data as DrinkData}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
    case "event":
      return (
        <EventCard
          content={content}
          data={content.data as EventData}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
    case "date_idea":
      return (
        <DateIdeaCard
          content={content}
          data={content.data as DateIdeaData}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
    case "gift_idea":
      return (
        <GiftIdeaCard
          content={content}
          data={content.data as GiftIdeaData}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
    case "travel":
      return (
        <TravelCard
          content={content}
          data={content.data as TravelData}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
    default:
      return (
        <OtherCard
          content={content}
          tags={contentTags}
          index={index}
          href={href}
          onToggleFavorite={onToggleFavorite}
        />
      );
  }
}
