"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  Content,
  MealData,
  EventData,
  DateIdeaData,
} from "@/lib/supabase";

// Generate Google Maps URL from location string
function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
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
  content: Content;
  index?: number;
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

function MealCard({ content, data }: { content: Content; data: MealData }) {
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

function EventCard({ content, data }: { content: Content; data: EventData }) {
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
}: {
  content: Content;
  data: DateIdeaData;
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

function OtherCard({ content }: { content: Content }) {
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

export function ContentCard({ content, index = 0 }: ContentCardProps) {
  const delayClass = `stagger-${Math.min(index + 1, 5)}`;

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
        <MealCard content={content} data={content.data as MealData} />
      )}
      {content.category === "event" && (
        <EventCard content={content} data={content.data as EventData} />
      )}
      {content.category === "date_idea" && (
        <DateIdeaCard content={content} data={content.data as DateIdeaData} />
      )}
      {content.category === "other" && <OtherCard content={content} />}
    </div>
  );
}
