"use client";

import { Button } from "@/components/ui/button";
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
  Calendar,
  Clock,
  Coffee,
  Gift,
  Heart,
  Loader2,
  MapPin,
  Plane,
  Pin,
  Utensils,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Category icon mapping
const CATEGORY_ICONS = {
  meal: Utensils,
  drink: Coffee,
  event: Calendar,
  date_idea: Heart,
  gift_idea: Gift,
  travel: Plane,
  other: Pin,
};

// Category labels
const CATEGORY_LABELS = {
  meal: "Recipe",
  drink: "Drink",
  event: "Event",
  date_idea: "Date",
  gift_idea: "Gift",
  travel: "Travel",
  other: "Saved",
};

// Generate Google Maps URL from location string
function getGoogleMapsUrl(location: string): string {
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
      className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"
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
}

// Tag display component for cards
function CardTags({ tags }: { tags?: Tag[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag.id}
          className="text-[10px] px-2 py-0.5 bg-accent border border-border font-medium"
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="text-[10px] text-muted-foreground font-mono">
          +{tags.length - 2}
        </span>
      )}
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

  return (
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`brutal-card brutal-processing overflow-hidden cursor-pointer h-full animate-slide-in stagger-${Math.min(index + 1, 5)}`}
      >
        <div className="aspect-square bg-accent flex items-center justify-center border-b-[3px] border-border">
          <div className="text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-2 animate-spin" />
            <p className="text-xs font-mono uppercase tracking-wider">
              Processing
            </p>
          </div>
        </div>
        <div className="p-3">
          <p className="font-bold text-sm">Adding...</p>
          <div className="brutal-loading mt-2">
            <div className="brutal-loading-bar" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full mt-3 text-xs brutal-btn bg-secondary text-secondary-foreground"
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
            <p className="text-[10px] text-destructive mt-1 font-mono">
              {retryMessage}
            </p>
          )}
        </div>
      </div>
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
  return (
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`brutal-card brutal-error overflow-hidden cursor-pointer h-full animate-slide-in stagger-${Math.min(index + 1, 5)}`}
      >
        <div className="aspect-square bg-red-50 flex items-center justify-center border-b-[3px] border-destructive">
          <div className="text-center">
            <XCircle className="w-10 h-10 mx-auto mb-2 text-destructive" />
            <p className="text-xs font-mono uppercase tracking-wider text-destructive">
              Failed
            </p>
          </div>
        </div>
        <div className="p-3">
          <p className="font-bold text-sm">Error</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Tap to retry
          </p>
        </div>
      </div>
    </Link>
  );
}

function ContentCardInner({
  content,
  tags,
  index = 0,
  meta,
}: {
  content: Content;
  tags?: Tag[];
  index?: number;
  meta?: React.ReactNode;
}) {
  const Icon = CATEGORY_ICONS[content.category as keyof typeof CATEGORY_ICONS] || Pin;
  const label = CATEGORY_LABELS[content.category as keyof typeof CATEGORY_LABELS] || "Saved";
  const bgClass = `bg-${content.category === "date_idea" ? "date" : content.category === "gift_idea" ? "gift" : content.category}-bg`;

  return (
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`brutal-card overflow-hidden cursor-pointer h-full animate-slide-in stagger-${Math.min(index + 1, 5)}`}
      >
        {/* Image */}
        <div className="border-b-[3px] border-border">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`aspect-square flex items-center justify-center ${
                content.category === "meal"
                  ? "bg-[#dcfce7]"
                  : content.category === "drink"
                    ? "bg-[#cffafe]"
                    : content.category === "event"
                      ? "bg-[#ede9fe]"
                      : content.category === "date_idea"
                        ? "bg-[#fce7f3]"
                        : content.category === "gift_idea"
                          ? "bg-[#ffedd5]"
                          : content.category === "travel"
                            ? "bg-[#dbeafe]"
                            : "bg-[#f5f5f4]"
              }`}
            >
              <Icon className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Badge */}
          <span className={`brutal-badge brutal-badge-${content.category} mb-2`}>
            <Icon className="w-3 h-3" />
            {label}
          </span>

          <h3 className="font-bold text-sm line-clamp-2 leading-tight">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          {meta && (
            <div className="mt-2 text-muted-foreground">{meta}</div>
          )}

          <p className="text-xs text-primary mt-2 font-mono uppercase tracking-wider">
            View →
          </p>
        </div>
      </div>
    </Link>
  );
}

function MealCard({
  content,
  data,
  tags,
  index = 0,
}: {
  content: Content;
  data: MealData;
  tags?: Tag[];
  index?: number;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        <div className="hidden md:flex flex-wrap gap-2 text-xs font-mono">
          {data.ingredients && data.ingredients.length > 0 && (
            <span>{data.ingredients.length} ing.</span>
          )}
          {data.prep_time && (
            <span className="flex items-center gap-1">
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
}: {
  content: Content;
  data: DrinkData;
  tags?: Tag[];
  index?: number;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        <div className="hidden md:flex flex-wrap gap-2 text-xs font-mono">
          {data.ingredients && data.ingredients.length > 0 && (
            <span>{data.ingredients.length} ing.</span>
          )}
          {data.type && <span className="capitalize">{data.type}</span>}
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
}: {
  content: Content;
  data: EventData;
  tags?: Tag[];
  index?: number;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        <div className="hidden md:block space-y-1 text-xs">
          {data.location && <LocationLink location={data.location} />}
          {data.date && (
            <p className="font-mono">
              {data.date} {data.time && `/ ${data.time}`}
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
}: {
  content: Content;
  data: DateIdeaData;
  tags?: Tag[];
  index?: number;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        <div className="hidden md:block space-y-1 text-xs">
          {data.location && <LocationLink location={data.location} />}
          {data.price_range && (
            <p className="font-mono">{data.price_range}</p>
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
}: {
  content: Content;
  data: GiftIdeaData;
  tags?: Tag[];
  index?: number;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        data.cost && (
          <p className="text-sm font-bold font-mono text-gift">{data.cost}</p>
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
}: {
  content: Content;
  data: TravelData;
  tags?: Tag[];
  index?: number;
}) {
  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        <div className="hidden md:block space-y-1 text-xs">
          {data.location && <LocationLink location={data.location} />}
          {data.destination_country && (
            <p className="font-mono flex items-center gap-1">
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
}: {
  content: Content;
  tags?: Tag[];
  index?: number;
}) {
  const data = content.data as { description?: string };

  return (
    <ContentCardInner
      content={content}
      tags={tags}
      index={index}
      meta={
        data.description && (
          <p className="hidden md:block text-xs line-clamp-2">
            {data.description}
          </p>
        )
      }
    />
  );
}

export function ContentCard({ content, index = 0, tags }: ContentCardProps) {
  // Get tags from content if it's ContentWithTags, or use provided tags
  const contentTags = tags || ("tags" in content ? content.tags : undefined);

  // Handle processing and failed states
  if (content.status === "processing") {
    return <ProcessingCard content={content} index={index} />;
  }

  if (content.status === "failed") {
    return <FailedCard content={content} index={index} />;
  }

  switch (content.category) {
    case "meal":
      return (
        <MealCard
          content={content}
          data={content.data as MealData}
          tags={contentTags}
          index={index}
        />
      );
    case "drink":
      return (
        <DrinkCard
          content={content}
          data={content.data as DrinkData}
          tags={contentTags}
          index={index}
        />
      );
    case "event":
      return (
        <EventCard
          content={content}
          data={content.data as EventData}
          tags={contentTags}
          index={index}
        />
      );
    case "date_idea":
      return (
        <DateIdeaCard
          content={content}
          data={content.data as DateIdeaData}
          tags={contentTags}
          index={index}
        />
      );
    case "gift_idea":
      return (
        <GiftIdeaCard
          content={content}
          data={content.data as GiftIdeaData}
          tags={contentTags}
          index={index}
        />
      );
    case "travel":
      return (
        <TravelCard
          content={content}
          data={content.data as TravelData}
          tags={contentTags}
          index={index}
        />
      );
    default:
      return <OtherCard content={content} tags={contentTags} index={index} />;
  }
}
