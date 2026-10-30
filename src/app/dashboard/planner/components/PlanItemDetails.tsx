"use client";

import { getGoogleMapsUrl } from "@/lib/map-links";
import { planItemDetails } from "@/lib/plan-item-details";
import type { PlanItem } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ArrowRight, Calendar, Clock, MapPin, StickyNote } from "lucide-react";
import Link from "next/link";

interface PlanItemDetailsProps {
  item: PlanItem;
  weekStart: string;
  /** Desktop columns are a seventh of the screen, so everything steps down. */
  compact?: boolean;
}

/**
 * The body of an expanded planner card. Collapsed, a card is a title and a
 * time; this is what answers "what do I need for this?" without leaving the
 * week. The detail page stays one tap away for everything else.
 */
export function PlanItemDetails({
  item,
  weekStart,
  compact = false,
}: PlanItemDetailsProps) {
  const details = planItemDetails(item);
  const text = compact ? "text-[11px]" : "text-xs";
  const icon = compact ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2", text)}>
      {details.attributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {details.attributes.map((attribute) => (
            <span
              key={attribute.key}
              className={cn(
                "rounded-full border border-[var(--border)] bg-[var(--card)] font-medium",
                compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
              )}
            >
              {attribute.label}
            </span>
          ))}
        </div>
      )}

      {details.when && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className={cn(icon, "shrink-0")} />
          <span>{details.when}</span>
        </p>
      )}

      {details.location && (
        <a
          href={getGoogleMapsUrl(details.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-[var(--primary)] transition-colors"
        >
          <MapPin className={cn(icon, "shrink-0")} />
          <span className="underline underline-offset-2 line-clamp-2">
            {details.location}
          </span>
        </a>
      )}

      {details.timings.length > 0 && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className={cn(icon, "shrink-0")} />
          <span>{details.timings.join(" · ")}</span>
        </p>
      )}

      {details.ingredients.length > 0 && (
        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          {details.ingredients.map((ingredient, i) => (
            <li key={i} className="line-clamp-1">
              {ingredient}
            </li>
          ))}
          {details.moreIngredients > 0 && (
            <li className="list-none -ml-4 italic">
              +{details.moreIngredients} more
            </li>
          )}
        </ul>
      )}

      {details.description && (
        <p
          className={cn(
            "text-muted-foreground",
            compact ? "line-clamp-4" : "line-clamp-3",
          )}
        >
          {details.description}
        </p>
      )}

      {/* A quick note is already drawn on the accent tint, so its note sits
          on the card as-is; on a white content card it gets the tint to read
          as the user's own words rather than extracted text. */}
      {details.note && (
        <p
          className={cn(
            "flex items-start gap-1.5 whitespace-pre-wrap",
            item.content && "rounded-lg bg-[var(--accent-light)] p-2",
          )}
        >
          <StickyNote
            className={cn(icon, "mt-0.5 shrink-0 text-[var(--accent)]")}
          />
          <span>{details.note}</span>
        </p>
      )}

      {item.content_id && (
        <Link
          href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
          className="inline-flex items-center gap-1 self-start font-semibold text-[var(--primary)] hover:underline"
        >
          Open
          <ArrowRight className={icon} />
        </Link>
      )}
    </div>
  );
}
