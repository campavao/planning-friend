"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FavoriteButton } from "@/components/favorite-button";
import { isFavorite } from "@/lib/favorites";
import { contentMeta } from "@/lib/plan-item-details";
import type { Content, ContentWithTags, Tag } from "@/lib/supabase";
import { Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { type ElementType, useState } from "react";
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

/** A category's icon in a small white disc, standing in for its named badge. */
function CategoryIcon({
  icon: Icon,
  label,
  className,
}: {
  icon: ElementType;
  label: string;
  className: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="surface-raised inline-flex size-7 items-center justify-center rounded-full"
    >
      <Icon className={`size-3.5 ${className}`} aria-hidden />
    </span>
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

/**
 * Makes the whole card navigate, without wrapping it in an anchor.
 *
 * The card contains its own links — the location opens Google Maps — and an
 * anchor inside an anchor is invalid HTML, which React reports as a hydration
 * error and browsers resolve by silently restructuring the DOM. The old
 * stopPropagation on the inner link stopped the double navigation but could not
 * make the markup legal.
 *
 * A stretched link keeps both as real anchors: middle-click, cmd-click and
 * "copy link address" all still work on each of them, which a div-with-onClick
 * would have thrown away.
 */
function CardLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  if (href === null) return <>{children}</>;
  return (
    <div className="relative h-full">
      {children}
      <Link
        href={href}
        aria-label={label}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      />
    </div>
  );
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
    // CardLink, not a wrapping <Link>: the Retry button below is interactive
    // content, and an <a> is not allowed to contain any. The handler's
    // preventDefault kept the click working, the same way LocationLink's
    // stopPropagation did, but neither makes the markup legal — and a button
    // inside a link is genuinely ambiguous to a screen reader.
    <CardLink href={`/dashboard/${content.id}`} label={content.title}>
      <Card
        className={`overflow-hidden cursor-pointer h-full hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] ${slide.className}`}
        style={slide.style}
      >
        <div className="aspect-[4/3] bg-[var(--accent-light)] flex items-center justify-center">
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
            // Above the stretched link, or the overlay swallows the click.
            className="relative z-10 w-full mt-3 text-xs"
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
    </CardLink>
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
        <div className="aspect-[4/3] bg-red-50 flex items-center justify-center">
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
  const { icon: Icon, label, text: iconTone } = categoryUI(content.category);
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
    <CardLink href={resolveHref(content, href)} label={content.title}>
      <Card
        className={`overflow-hidden cursor-pointer h-full hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] ${slide.className}`}
        style={slide.style}
      >
        {/* Image. Items without one — quick notes, anything whose thumbnail
            didn't come through — drop the block entirely rather than show a
            placeholder, and carry their category badge inline instead. */}
        {content.thumbnail_url && (
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Category as its icon alone, the way planner cards carry it —
                the name is there for screen readers and on hover. */}
            <div className="absolute top-3 left-3">
              <CategoryIcon icon={Icon} label={label} className={iconTone} />
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
              <CategoryIcon icon={Icon} label={label} className={iconTone} />
              {star}
            </div>
          )}
          <h3 className="font-semibold text-sm line-clamp-2 leading-snug mb-1">
            {content.title}
          </h3>

          {meta && (
            <div className="mt-1 text-muted-foreground">{meta}</div>
          )}
        </div>
      </Card>
    </CardLink>
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

  // An explicit meta replaces the default one, so callers like the planner
  // can show a planned time in the same slot. The default is the same short
  // line the home page and planner cards use — cook time, venue, price.
  const fallback = contentMeta(content);
  return (
    <ContentCardInner
      content={content}
      tags={contentTags}
      index={index}
      href={href}
      onToggleFavorite={onToggleFavorite}
      meta={
        meta !== undefined ? (
          meta
        ) : fallback ? (
          <p className="truncate text-xs">{fallback}</p>
        ) : null
      }
    />
  );
}
