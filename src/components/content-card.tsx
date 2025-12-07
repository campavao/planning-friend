'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Content, MealData, EventData, DateIdeaData } from '@/lib/supabase';

interface ContentCardProps {
  content: Content;
  index?: number;
}

function MealCard({ content, data }: { content: Content; data: MealData }) {
  return (
    <Card className="glass overflow-hidden group hover:border-meal/50 transition-all duration-300">
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
        <CardTitle className="text-lg font-semibold line-clamp-2">{content.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.ingredients && data.ingredients.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Ingredients</h4>
            <ul className="text-sm space-y-1">
              {data.ingredients.slice(0, 5).map((ingredient, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{ingredient}</span>
                </li>
              ))}
              {data.ingredients.length > 5 && (
                <li className="text-muted-foreground text-xs">
                  +{data.ingredients.length - 5} more ingredients
                </li>
              )}
            </ul>
          </div>
        )}
        {data.recipe && data.recipe.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Quick Steps</h4>
            <ol className="text-sm space-y-1">
              {data.recipe.slice(0, 3).map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-mono text-xs bg-primary/20 rounded px-1.5 py-0.5">
                    {i + 1}
                  </span>
                  <span className="line-clamp-2">{step}</span>
                </li>
              ))}
              {data.recipe.length > 3 && (
                <li className="text-muted-foreground text-xs">
                  +{data.recipe.length - 3} more steps
                </li>
              )}
            </ol>
          </div>
        )}
        <div className="flex gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
          {data.prep_time && <span>⏱️ Prep: {data.prep_time}</span>}
          {data.cook_time && <span>🔥 Cook: {data.cook_time}</span>}
          {data.servings && <span>👥 Serves: {data.servings}</span>}
        </div>
        <a
          href={content.tiktok_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Watch on TikTok →
        </a>
      </CardContent>
    </Card>
  );
}

function EventCard({ content, data }: { content: Content; data: EventData }) {
  return (
    <Card className="glass overflow-hidden group hover:border-event/50 transition-all duration-300">
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
        <CardTitle className="text-lg font-semibold line-clamp-2">{content.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.location && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-lg">📍</span>
            <span>{data.location}</span>
          </div>
        )}
        {(data.date || data.time) && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-lg">📅</span>
            <span>
              {data.date && data.date}
              {data.date && data.time && ' at '}
              {data.time && data.time}
            </span>
          </div>
        )}
        {data.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{data.description}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {data.requires_reservation && (
            <Badge variant="outline" className="text-xs">
              🎫 Reservation Required
            </Badge>
          )}
          {data.requires_ticket && (
            <Badge variant="outline" className="text-xs">
              🎟️ Ticket Required
            </Badge>
          )}
        </div>
        <a
          href={content.tiktok_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Watch on TikTok →
        </a>
      </CardContent>
    </Card>
  );
}

function DateIdeaCard({ content, data }: { content: Content; data: DateIdeaData }) {
  const typeEmoji: Record<string, string> = {
    dinner: '🍷',
    activity: '🎯',
    entertainment: '🎭',
    outdoors: '🌲',
    other: '💡',
  };

  return (
    <Card className="glass overflow-hidden group hover:border-date/50 transition-all duration-300">
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
        <CardTitle className="text-lg font-semibold line-clamp-2">{content.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.location && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-lg">📍</span>
            <span>{data.location}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {data.type && (
            <Badge variant="outline" className="text-xs">
              {typeEmoji[data.type] || '💡'} {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
            </Badge>
          )}
          {data.price_range && (
            <Badge variant="outline" className="text-xs">
              {data.price_range}
            </Badge>
          )}
        </div>
        {data.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{data.description}</p>
        )}
        <a
          href={content.tiktok_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Watch on TikTok →
        </a>
      </CardContent>
    </Card>
  );
}

function OtherCard({ content }: { content: Content }) {
  const data = content.data as { description?: string };
  
  return (
    <Card className="glass overflow-hidden group hover:border-other/50 transition-all duration-300">
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
        <CardTitle className="text-lg font-semibold line-clamp-2">{content.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.description && (
          <p className="text-sm text-muted-foreground line-clamp-4">{data.description}</p>
        )}
        <a
          href={content.tiktok_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Watch on TikTok →
        </a>
      </CardContent>
    </Card>
  );
}

export function ContentCard({ content, index = 0 }: ContentCardProps) {
  const delayClass = `stagger-${Math.min(index + 1, 5)}`;
  
  return (
    <div className={`animate-fade-in-up opacity-0 ${delayClass}`}>
      {content.category === 'meal' && (
        <MealCard content={content} data={content.data as MealData} />
      )}
      {content.category === 'event' && (
        <EventCard content={content} data={content.data as EventData} />
      )}
      {content.category === 'date_idea' && (
        <DateIdeaCard content={content} data={content.data as DateIdeaData} />
      )}
      {content.category === 'other' && (
        <OtherCard content={content} />
      )}
    </div>
  );
}

