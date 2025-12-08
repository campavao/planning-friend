"use client";

import Link from "next/link";
import type {
  Content,
  MealData,
  EventData,
  DateIdeaData,
  GiftIdeaData,
  TravelData,
  DrinkData,
  Tag,
  ContentWithTags,
} from "@/lib/supabase";

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
      className="flex items-start gap-1.5 text-sm hover:text-primary transition-colors"
    >
      <span>📍</span>
      <span className="line-clamp-1 underline decoration-dotted underline-offset-2">
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
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag.id}
          className="text-[10px] px-2 py-0.5 rounded-full bg-washi-yellow/40 text-foreground/70 font-medium"
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[10px] text-muted-foreground">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}

// Get rotation class for organic feel
function getRotation(index: number): string {
  const rotations = [
    "rotate-1",
    "rotate-neg-1",
    "rotate-2",
    "rotate-neg-2",
    "",
  ];
  return rotations[index % rotations.length];
}

// Get washi tape color class
function getWashiColor(category: string): string {
  const colors: Record<string, string> = {
    meal: "bg-washi-mint/80",
    drink: "bg-washi-blue/80",
    event: "bg-washi-lavender/80",
    date_idea: "bg-washi-pink/80",
    gift_idea: "bg-washi-coral/80",
    travel: "bg-washi-blue/80",
    other: "bg-washi-yellow/80",
  };
  return colors[category] || "bg-washi-yellow/80";
}

function ProcessingCard({
  content,
  index = 0,
}: {
  content: Content;
  index?: number;
}) {
  return (
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        {/* Washi tape */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 md:w-14 h-4 md:h-5 bg-washi-yellow/80 transform -rotate-2 z-10" />

        <div className="relative aspect-square bg-secondary/30 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-2 animate-wiggle">✂️</div>
            <p className="text-xs md:text-sm text-muted-foreground font-handwritten">
              Clipping...
            </p>
          </div>
        </div>
        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <p className="font-medium text-xs md:text-sm line-clamp-2">
            Adding...
          </p>
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
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} border-destructive/20 relative`}
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 md:w-14 h-4 md:h-5 bg-washi-coral/80 transform rotate-1 z-10" />

        <div className="relative aspect-square bg-destructive/5 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-2">😕</div>
            <p className="text-xs md:text-sm text-muted-foreground">Failed</p>
          </div>
        </div>
        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <p className="font-medium text-xs md:text-sm">Oops</p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
            Tap to retry
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        {/* Washi tape decoration */}
        <div
          className={`absolute -top-2 left-6 w-14 h-5 ${getWashiColor(
            "meal"
          )} transform -rotate-2 z-10`}
        />

        {/* Polaroid-style image */}
        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">🍽️</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          {/* Sticker badge */}
          <span className="sticker sticker-meal text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            🍽️ Recipe
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          <div className="hidden md:flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {data.ingredients && data.ingredients.length > 0 && (
              <span>{data.ingredients.length} ingredients</span>
            )}
            {data.prep_time && <span>⏱️ {data.prep_time}</span>}
          </div>

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        <div
          className={`absolute -top-2 right-6 w-12 h-5 ${getWashiColor(
            "drink"
          )} transform rotate-1 z-10`}
        />

        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">🍹</span>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <span className="sticker sticker-drink text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            🍹 Drink
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          <div className="hidden md:flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {data.ingredients && data.ingredients.length > 0 && (
              <span>{data.ingredients.length} ingredients</span>
            )}
            {data.type && <span className="capitalize">{data.type}</span>}
          </div>

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        <div
          className={`absolute -top-2 left-8 w-16 h-5 ${getWashiColor(
            "event"
          )} transform -rotate-1 z-10`}
        />

        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">🎉</span>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <span className="sticker sticker-event text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            🎉 Event
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          <div className="hidden md:block space-y-1 mt-2">
            {data.location && <LocationLink location={data.location} />}
            {data.date && (
              <p className="text-xs text-muted-foreground">
                📅 {data.date} {data.time && `at ${data.time}`}
              </p>
            )}
          </div>

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        <div
          className={`absolute -top-2 right-8 w-14 h-5 ${getWashiColor(
            "date_idea"
          )} transform rotate-2 z-10`}
        />

        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">💕</span>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <span className="sticker sticker-date_idea text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            💕 Date
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          <div className="hidden md:block space-y-1 mt-2">
            {data.location && <LocationLink location={data.location} />}
            {data.price_range && (
              <p className="text-xs text-muted-foreground">
                {data.price_range}
              </p>
            )}
          </div>

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        <div
          className={`absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 ${getWashiColor(
            "gift_idea"
          )} transform -rotate-1 z-10`}
        />

        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">🎁</span>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <span className="sticker sticker-gift_idea text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            🎁 Gift
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          {data.cost && (
            <p className="text-xs md:text-sm font-semibold text-gift mt-1.5 md:mt-2">
              {data.cost}
            </p>
          )}

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        <div
          className={`absolute -top-2 left-6 w-16 h-5 ${getWashiColor(
            "travel"
          )} transform rotate-1 z-10`}
        />

        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">✈️</span>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <span className="sticker sticker-travel text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            ✈️ Travel
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          <div className="hidden md:block space-y-1 mt-2">
            {data.location && <LocationLink location={data.location} />}
            {data.destination_country && (
              <p className="text-xs text-muted-foreground">
                🌍 {data.destination_city && `${data.destination_city}, `}
                {data.destination_country}
              </p>
            )}
          </div>

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
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
    <Link href={`/dashboard/${content.id}`}>
      <div
        className={`scrapbook-card overflow-hidden group hover-lift cursor-pointer h-full ${getRotation(
          index
        )} relative`}
      >
        <div
          className={`absolute -top-2 right-6 w-14 h-5 ${getWashiColor(
            "other"
          )} transform -rotate-2 z-10`}
        />

        <div className="p-1.5 md:p-2 pb-0">
          {content.thumbnail_url ? (
            <div className="relative aspect-square overflow-hidden rounded bg-muted">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded flex items-center justify-center">
              <span className="text-3xl md:text-4xl">📌</span>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 pt-1.5 md:pt-2">
          <span className="sticker sticker-other text-[8px] md:text-[10px] mb-1.5 md:mb-2 inline-block">
            📌 Saved
          </span>

          <h3 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
            {content.title}
          </h3>

          <CardTags tags={tags} />

          {data.description && (
            <p className="hidden md:block text-xs text-muted-foreground mt-2 line-clamp-2">
              {data.description}
            </p>
          )}

          <p className="text-[10px] md:text-xs text-primary mt-1.5 md:mt-2 group-hover:underline">
            View →
          </p>
        </div>
      </div>
    </Link>
  );
}

export function ContentCard({ content, index = 0, tags }: ContentCardProps) {
  const delayClass = `stagger-${Math.min(index + 1, 5)}`;

  // Get tags from content if it's ContentWithTags, or use provided tags
  const contentTags = tags || ("tags" in content ? content.tags : undefined);

  // Handle processing and failed states
  if (content.status === "processing") {
    return (
      <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
        <ProcessingCard content={content} index={index} />
      </div>
    );
  }

  if (content.status === "failed") {
    return (
      <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
        <FailedCard content={content} index={index} />
      </div>
    );
  }

  return (
    <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
      {content.category === "meal" && (
        <MealCard
          content={content}
          data={content.data as MealData}
          tags={contentTags}
          index={index}
        />
      )}
      {content.category === "drink" && (
        <DrinkCard
          content={content}
          data={content.data as DrinkData}
          tags={contentTags}
          index={index}
        />
      )}
      {content.category === "event" && (
        <EventCard
          content={content}
          data={content.data as EventData}
          tags={contentTags}
          index={index}
        />
      )}
      {content.category === "date_idea" && (
        <DateIdeaCard
          content={content}
          data={content.data as DateIdeaData}
          tags={contentTags}
          index={index}
        />
      )}
      {content.category === "gift_idea" && (
        <GiftIdeaCard
          content={content}
          data={content.data as GiftIdeaData}
          tags={contentTags}
          index={index}
        />
      )}
      {content.category === "travel" && (
        <TravelCard
          content={content}
          data={content.data as TravelData}
          tags={contentTags}
          index={index}
        />
      )}
      {content.category === "other" && (
        <OtherCard content={content} tags={contentTags} index={index} />
      )}
    </div>
  );
}
