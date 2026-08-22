"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ContentCategory } from "@/lib/supabase";
import {
  DATE_IDEA_TYPES,
  DRINK_DIFFICULTIES,
  DRINK_TYPES,
  PRICE_RANGES,
  RECIPE_EFFORTS,
  SPICE_LEVELS,
  TRAVEL_TYPES,
} from "@/lib/schemas/content";
import { EditableLines } from "./EditableLines";

/**
 * Edit mode for the category-specific half of an item.
 *
 * The form works on the raw `data` blob rather than a per-category struct: the
 * page hands it the object it was seeded with and gets a new object back, so a
 * key this editor has no field for is carried through untouched instead of
 * being dropped on the way to the save.
 */

/** Radix Select has no empty-valued item, so clearing needs a stand-in value.
 *  It never leaves this file — onChange turns it back into "". */
const UNSET = "__unset";

type FieldSpec =
  | { key: string; label: string; kind: "text"; placeholder?: string }
  | { key: string; label: string; kind: "link"; placeholder?: string }
  | { key: string; label: string; kind: "textarea"; placeholder?: string }
  | { key: string; label: string; kind: "select"; options: readonly string[] }
  | { key: string; label: string; kind: "toggle" };

// Mirrors the interfaces in src/lib/db/types.ts — every field the extraction
// can fill for a category, in the order it reads on the page.
const CATEGORY_FIELDS: Record<ContentCategory, FieldSpec[]> = {
  meal: [
    { key: "effort", label: "Effort", kind: "select", options: RECIPE_EFFORTS },
    { key: "spice", label: "Spice level", kind: "select", options: SPICE_LEVELS },
    { key: "prep_time", label: "Prep time", kind: "text", placeholder: "15 min" },
    { key: "cook_time", label: "Cook time", kind: "text", placeholder: "40 min" },
    { key: "servings", label: "Servings", kind: "text", placeholder: "4" },
  ],
  drink: [
    { key: "type", label: "Type", kind: "select", options: DRINK_TYPES },
    { key: "prep_time", label: "Prep time", kind: "text", placeholder: "5 min" },
    {
      key: "difficulty",
      label: "Difficulty",
      kind: "select",
      options: DRINK_DIFFICULTIES,
    },
    { key: "description", label: "Description", kind: "textarea" },
  ],
  event: [
    { key: "location", label: "Location", kind: "text" },
    { key: "date", label: "Date", kind: "text", placeholder: "June 14" },
    { key: "time", label: "Time", kind: "text", placeholder: "7:00 PM" },
    { key: "seats", label: "Seats", kind: "text", placeholder: "310, 312" },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "website", label: "Website", kind: "link" },
    { key: "ticket_link", label: "Ticket link", kind: "link" },
    { key: "reservation_link", label: "Reservation link", kind: "link" },
    { key: "requires_reservation", label: "Reservation required", kind: "toggle" },
    { key: "requires_ticket", label: "Ticket required", kind: "toggle" },
  ],
  date_idea: [
    { key: "location", label: "Location", kind: "text" },
    { key: "type", label: "Type", kind: "select", options: DATE_IDEA_TYPES },
    {
      key: "price_range",
      label: "Price range",
      kind: "select",
      options: PRICE_RANGES,
    },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "website", label: "Website", kind: "link" },
    { key: "menu_link", label: "Menu link", kind: "link" },
    { key: "reservation_link", label: "Reservation link", kind: "link" },
  ],
  gift_idea: [
    { key: "name", label: "Product name", kind: "text" },
    { key: "cost", label: "Cost", kind: "text", placeholder: "$29.99" },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "purchase_link", label: "Purchase link", kind: "link" },
    { key: "amazon_link", label: "Amazon link", kind: "link" },
  ],
  travel: [
    { key: "location", label: "Location", kind: "text" },
    { key: "type", label: "Type", kind: "select", options: TRAVEL_TYPES },
    { key: "destination_city", label: "City", kind: "text" },
    { key: "destination_country", label: "Country", kind: "text" },
    {
      key: "price_range",
      label: "Price range",
      kind: "select",
      options: PRICE_RANGES,
    },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "website", label: "Website", kind: "link" },
    { key: "booking_link", label: "Booking link", kind: "link" },
  ],
  other: [{ key: "description", label: "Description", kind: "textarea" }],
};

/** Categories whose data carries an ingredients/instructions pair. */
const RECIPE_CATEGORIES = { meal: "meal", drink: "drink" } as const;

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  // A number is what an extraction sometimes leaves in `servings`; show it
  // rather than an empty box that would read as "we found nothing".
  if (typeof value === "number") return String(value);
  return "";
}

function toLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((line) => toText(line));
}

interface ContentDataEditorProps {
  category: ContentCategory;
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function ContentDataEditor({
  category,
  data,
  onChange,
}: ContentDataEditorProps) {
  const setField = (key: string, value: unknown) => {
    onChange({ ...data, [key]: value });
  };

  const recipeVariant =
    category in RECIPE_CATEGORIES
      ? RECIPE_CATEGORIES[category as keyof typeof RECIPE_CATEGORIES]
      : null;

  return (
    <div className="space-y-6">
      {recipeVariant && (
        <>
          <EditableLines
            label="Equipment"
            itemLabel="item"
            values={toLines(data.equipment)}
            onChange={(next) => setField("equipment", next)}
            variant={recipeVariant}
            placeholder="Slow cooker"
          />
          <EditableLines
            label="Ingredients"
            itemLabel="ingredient"
            values={toLines(data.ingredients)}
            onChange={(next) => setField("ingredients", next)}
            variant={recipeVariant}
            placeholder="2 cups flour"
          />
          <EditableLines
            label="Instructions"
            itemLabel="step"
            values={toLines(data.recipe)}
            onChange={(next) => setField("recipe", next)}
            variant={recipeVariant}
            ordered
            placeholder="Preheat the oven to 350°F"
          />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CATEGORY_FIELDS[category]?.map((field) => {
          const id = `content-field-${field.key}`;
          const value = data[field.key];

          if (field.kind === "toggle") {
            const on = value === true;
            return (
              <div key={field.key} className="flex items-center">
                <Button
                  type="button"
                  variant={on ? "default" : "outline"}
                  aria-pressed={on}
                  onClick={() => setField(field.key, !on)}
                >
                  {field.label}
                </Button>
              </div>
            );
          }

          if (field.kind === "select") {
            const current = toText(value);
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={id}>{field.label}</Label>
                <Select
                  value={field.options.includes(current) ? current : UNSET}
                  onValueChange={(next) =>
                    setField(field.key, next === UNSET ? "" : next)
                  }
                >
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>Not set</SelectItem>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.kind === "textarea") {
            return (
              <div key={field.key} className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={id}>{field.label}</Label>
                <Textarea
                  id={id}
                  value={toText(value)}
                  placeholder={field.placeholder}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              </div>
            );
          }

          return (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                value={toText(value)}
                inputMode={field.kind === "link" ? "url" : undefined}
                placeholder={
                  field.kind === "link" ? "https://" : field.placeholder
                }
                onChange={(e) => setField(field.key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
