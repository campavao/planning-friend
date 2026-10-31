"use client";

import { AttributeChips } from "@/app/dashboard/[id]/components/AttributeChips";
import {
  ItemProse,
  ItemRow,
  ItemRows,
} from "@/app/dashboard/[id]/components/ItemRow";
import { getGoogleMapsUrl } from "@/lib/map-links";
import {
  planItemDetails,
  type PlanItemDetails as PlanItemDetailsData,
} from "@/lib/plan-item-details";
import type { PlanItem } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Calendar,
  Clock,
  HelpCircle,
  MapPin,
  NotebookPen,
  Salad,
  StickyNote,
} from "lucide-react";
import Link from "next/link";

interface PlanItemDetailsProps {
  item: PlanItem;
  weekStart: string;
  /**
   * Desktop columns are a seventh of the screen — too narrow for the item
   * page's rows — so they get a condensed list with its own Open link.
   */
  compact?: boolean;
}

/**
 * The body of an expanded planner card. Collapsed, a card is a title and a
 * time; this is what answers "what do I need for this?" without leaving the
 * week.
 *
 * The full layout is built from the item page's own pieces — its attribute
 * chips and icon rows — so an opened card reads as a preview of the page it
 * links to. The card supplies the header and the Open button around it.
 */
export function PlanItemDetails({
  item,
  weekStart,
  compact = false,
}: PlanItemDetailsProps) {
  const details = planItemDetails(item);

  if (compact) {
    return <CompactDetails item={item} weekStart={weekStart} />;
  }

  // A quick note has no item page to echo: it is already drawn on the accent
  // tint, and its body is all there is to show.
  if (!item.content) {
    return details.note ? (
      <p className="flex items-start gap-1.5 whitespace-pre-wrap text-xs">
        <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--accent)]" />
        <span>{details.note}</span>
      </p>
    ) : null;
  }

  const ingredientTone =
    item.content.category === "drink"
      ? "text-[var(--drink)]"
      : "text-[var(--meal)]";

  return (
    // A little air between the card's tinted header and the first chips.
    <div className="pt-2">
      <AttributeChips
        category={item.content.category}
        data={item.content.data as Record<string, unknown>}
      />
      <div className="px-2">
        <ItemRows>
          {details.location && (
            <ItemRow
              icon={MapPin}
              iconClassName="text-[var(--primary)]"
              href={getGoogleMapsUrl(details.location)}
            >
              {details.location}
            </ItemRow>
          )}
          {details.when && (
            <ItemRow
              icon={item.content.category === "travel" ? Calendar : Clock}
              iconClassName={
                item.content.category === "travel"
                  ? "text-[var(--travel)]"
                  : "text-[var(--event)]"
              }
            >
              {details.when}
            </ItemRow>
          )}
          {details.ingredients.length > 0 && (
            // ItemRow's value is a span, which can't hold a list, so this is
            // the same row built by hand.
            <div className="w-full flex items-start gap-3 px-2 py-3.5">
              <span className="w-6 shrink-0 flex justify-center pt-0.5">
                <Salad className={cn("w-5 h-5", ingredientTone)} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
                  Ingredients
                </p>
                <ul className="space-y-1 text-[13.5px] leading-snug">
                  {details.ingredients.map((ingredient, i) => (
                    <li key={i} className="line-clamp-1">
                      {ingredient}
                    </li>
                  ))}
                  {details.moreIngredients > 0 && (
                    <li className="text-muted-foreground">
                      +{details.moreIngredients} more
                    </li>
                  )}
                </ul>
                {details.timings.length > 0 && <Timings details={details} />}
              </div>
            </div>
          )}
          {/* No ingredients to sit under: the timings take their own row. */}
          {details.ingredients.length === 0 && details.timings.length > 0 && (
            <div className="px-2 py-3.5">
              <Timings details={details} />
            </div>
          )}
          {details.description && (
            <ItemProse icon={HelpCircle} label="About">
              <span className="line-clamp-4">{details.description}</span>
            </ItemProse>
          )}
          {details.note && (
            <ItemRow
              icon={NotebookPen}
              iconClassName="text-[var(--primary)]"
              label="Your note"
            >
              <span className="font-normal text-[13.5px] whitespace-pre-wrap">
                {details.note}
              </span>
            </ItemRow>
          )}
        </ItemRows>
      </div>
    </div>
  );
}

/** The item page's recipe facts line: small and quiet, under the ingredients,
 *  rather than a full-weight row that wraps on a phone. */
function Timings({ details }: { details: PlanItemDetailsData }) {
  return (
    <p className="flex items-center gap-1.5 pt-3 text-[12.5px] font-medium text-muted-foreground">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      {details.timings.join(" · ")}
    </p>
  );
}

function CompactDetails({
  item,
  weekStart,
}: {
  item: PlanItem;
  weekStart: string;
}) {
  const details = planItemDetails(item);

  return (
    <div className="flex flex-col gap-1.5 text-[11px]">
      {details.attributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {details.attributes.map((attribute) => (
            <span
              key={attribute.key}
              className="surface-inset rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            >
              {attribute.label}
            </span>
          ))}
        </div>
      )}

      {details.when && (
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="w-3 h-3 shrink-0 text-[var(--event)]" />
          <span>{details.when}</span>
        </p>
      )}

      {details.location && (
        <a
          href={getGoogleMapsUrl(details.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-medium hover:text-[var(--primary)] transition-colors"
        >
          <MapPin className="w-3 h-3 shrink-0 text-[var(--primary)]" />
          <span className="underline underline-offset-2 line-clamp-2">
            {details.location}
          </span>
        </a>
      )}

      {details.timings.length > 0 && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3 shrink-0" />
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
            <li className="list-none -ml-4">+{details.moreIngredients} more</li>
          )}
        </ul>
      )}

      {details.description && (
        <p className="text-muted-foreground line-clamp-4">
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
          <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>{details.note}</span>
        </p>
      )}

      {item.content_id && (
        <Link
          href={`/dashboard/${item.content_id}?from=planner&week=${weekStart}`}
          className="inline-flex items-center gap-1 self-start font-semibold text-[var(--primary)] hover:underline"
        >
          Open
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
