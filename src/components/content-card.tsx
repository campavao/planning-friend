"use client";

import Link from "next/link";
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
      className="flex items-start gap-2 text-sm hover:text-primary transition-colors"
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
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
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

function ProcessingCard({ content }: { content: Content }) {
  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-primary/50 transition-all duration-300 cursor-pointer animate-pulse">
        <div className="relative h-40 bg-secondary/50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">⏳</div>
            <p className="text-sm text-muted-foreground">Processing...</p>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            Analyzing TikTok...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {content.tiktok_url}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function FailedCard({ content }: { content: Content }) {
  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-destructive/50 transition-all duration-300 cursor-pointer border-destructive/30">
        <div className="relative h-40 bg-destructive/10 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">❌</div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            Processing Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Click to view details or delete
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function MealCard({ content, data, tags }: { content: Content; data: MealData; tags?: Tag[] }) {
  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-meal/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-meal border">
            🍽️ Meal
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.ingredients && data.ingredients.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {data.ingredients.length} ingredients
            </p>
          )}
          {data.recipe && data.recipe.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {data.recipe.length} steps
            </p>
          )}
          <div className="flex gap-3 text-xs text-muted-foreground">
            {data.prep_time && <span>⏱️ {data.prep_time}</span>}
            {data.cook_time && <span>🔥 {data.cook_time}</span>}
          </div>
          <p className="text-sm text-primary group-hover:underline">
            View full recipe →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EventCard({ content, data, tags }: { content: Content; data: EventData; tags?: Tag[] }) {
  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-event/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-event border">
            🎉 Event
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.location && <LocationLink location={data.location} />}
          {(data.date || data.time) && (
            <div className="flex items-start gap-2 text-sm">
              <span>📅</span>
              <span>
                {data.date}
                {data.date && data.time && " at "}
                {data.time}
              </span>
            </div>
          )}
          <p className="text-sm text-primary group-hover:underline">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function DateIdeaCard({
  content,
  data,
  tags,
}: {
  content: Content;
  data: DateIdeaData;
  tags?: Tag[];
}) {
  const typeEmoji: Record<string, string> = {
    dinner: "🍷",
    activity: "🎯",
    entertainment: "🎭",
    outdoors: "🌲",
    other: "💡",
  };

  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-date/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-date_idea border">
            💕 Date Idea
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.location && <LocationLink location={data.location} />}
          <div className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="outline" className="text-xs">
                {typeEmoji[data.type] || "💡"}{" "}
                {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
              </Badge>
            )}
            {data.price_range && (
              <Badge variant="outline" className="text-xs">
                {data.price_range}
              </Badge>
            )}
          </div>
          <p className="text-sm text-primary group-hover:underline">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function GiftIdeaCard({
  content,
  data,
  tags,
}: {
  content: Content;
  data: GiftIdeaData;
  tags?: Tag[];
}) {
  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-gift/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-gift_idea border">
            🎁 Gift Idea
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.cost && (
            <div className="flex items-center gap-2 text-sm">
              <span>💰</span>
              <span className="font-medium text-gift">{data.cost}</span>
            </div>
          )}
          {data.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {data.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {data.amazon_link && (
              <a
                href={data.amazon_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-orange-500 hover:underline"
              >
                View on Amazon →
              </a>
            )}
            {data.purchase_link && !data.amazon_link && (
              <a
                href={data.purchase_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:underline"
              >
                Buy Now →
              </a>
            )}
          </div>
          <p className="text-sm text-primary group-hover:underline">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function TravelCard({
  content,
  data,
  tags,
}: {
  content: Content;
  data: TravelData;
  tags?: Tag[];
}) {
  const typeEmoji: Record<string, string> = {
    restaurant: "🍽️",
    attraction: "🏛️",
    hotel: "🏨",
    activity: "🎯",
    other: "📍",
  };

  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-travel/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-travel border">
            ✈️ Travel
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.location && <LocationLink location={data.location} />}
          <div className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="outline" className="text-xs">
                {typeEmoji[data.type] || "📍"}{" "}
                {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
              </Badge>
            )}
            {data.price_range && (
              <Badge variant="outline" className="text-xs">
                {data.price_range}
              </Badge>
            )}
          </div>
          <p className="text-sm text-primary group-hover:underline">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function DrinkCard({
  content,
  data,
  tags,
}: {
  content: Content;
  data: DrinkData;
  tags?: Tag[];
}) {
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
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-drink/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-drink border">
            🍹 Drink
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.ingredients && data.ingredients.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {data.ingredients.length} ingredients
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant="outline" className="text-xs">
                {typeEmoji[data.type] || "🥃"}{" "}
                {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
              </Badge>
            )}
            {data.difficulty && (
              <Badge variant="outline" className="text-xs">
                {data.difficulty}
              </Badge>
            )}
          </div>
          <p className="text-sm text-primary group-hover:underline">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function OtherCard({ content, tags }: { content: Content; tags?: Tag[] }) {
  const data = content.data as { description?: string };

  return (
    <Link href={`/dashboard/${content.id}`}>
      <Card className="glass overflow-hidden group hover:border-other/50 transition-all duration-300 cursor-pointer h-full">
        <div className="relative">
          {content.thumbnail_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <Badge className="absolute top-3 right-3 badge-other border">
            📌 Saved
          </Badge>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {content.title}
          </CardTitle>
          <CardTags tags={tags} />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {data.description}
            </p>
          )}
          <p className="text-sm text-primary group-hover:underline">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ContentCard({ content, index = 0, tags }: ContentCardProps) {
  const delayClass = `stagger-${Math.min(index + 1, 5)}`;
  
  // Get tags from content if it's ContentWithTags, or use provided tags
  const contentTags = tags || ('tags' in content ? content.tags : undefined);

  // Handle processing and failed states
  if (content.status === "processing") {
    return (
      <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
        <ProcessingCard content={content} />
      </div>
    );
  }

  if (content.status === "failed") {
    return (
      <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
        <FailedCard content={content} />
      </div>
    );
  }

  return (
    <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
      {content.category === "meal" && (
        <MealCard content={content} data={content.data as MealData} tags={contentTags} />
      )}
      {content.category === "drink" && (
        <DrinkCard content={content} data={content.data as DrinkData} tags={contentTags} />
      )}
      {content.category === "event" && (
        <EventCard content={content} data={content.data as EventData} tags={contentTags} />
      )}
      {content.category === "date_idea" && (
        <DateIdeaCard content={content} data={content.data as DateIdeaData} tags={contentTags} />
      )}
      {content.category === "gift_idea" && (
        <GiftIdeaCard content={content} data={content.data as GiftIdeaData} tags={contentTags} />
      )}
      {content.category === "travel" && (
        <TravelCard content={content} data={content.data as TravelData} tags={contentTags} />
      )}
      {content.category === "other" && <OtherCard content={content} tags={contentTags} />}
    </div>
  );
}
