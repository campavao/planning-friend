"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RECIPE_VARIANT_CLASSES, type RecipeVariant } from "./RecipeSteps";

interface EditableLinesProps {
  /** Heading, matching the one RecipeSteps shows for the same list. */
  label: string;
  /** Singular noun for the per-row controls: "ingredient", "step". */
  itemLabel: string;
  values: string[];
  onChange: (next: string[]) => void;
  variant?: RecipeVariant;
  /** Steps are numbered; ingredients get the same checkbox-shaped marker the
   *  read-only list uses, so the row count and rhythm don't shift on edit. */
  ordered?: boolean;
  placeholder?: string;
}

export function EditableLines({
  label,
  itemLabel,
  values,
  onChange,
  variant = "meal",
  ordered = false,
  placeholder,
}: EditableLinesProps) {
  const classes = RECIPE_VARIANT_CLASSES[variant];

  const setLine = (index: number, value: string) => {
    onChange(values.map((line, i) => (i === index ? value : line)));
  };

  const removeLine = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const moveLine = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <h3 className="heading-3 mb-3">{label}</h3>

      <Card className="border border-[var(--border)] shadow-none overflow-hidden divide-y divide-[var(--border)]">
        {values.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            Nothing here yet.
          </p>
        )}

        {values.map((line, i) => (
          <div key={i} className="flex items-center gap-2 p-3">
            <span
              className={cn(
                "shrink-0 flex items-center justify-center font-semibold text-white",
                ordered
                  ? `w-9 h-9 rounded-xl ${classes.stepBg}`
                  : `w-6 h-6 rounded-lg border-2 ${classes.ingredientBorder}`
              )}
            >
              {ordered ? i + 1 : null}
            </span>

            <Input
              value={line}
              onChange={(e) => setLine(i, e.target.value)}
              placeholder={placeholder}
              aria-label={`${itemLabel} ${i + 1}`}
              className="flex-1"
            />

            <div className="flex shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => moveLine(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${itemLabel} ${i + 1} up`}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => moveLine(i, 1)}
                disabled={i === values.length - 1}
                aria-label={`Move ${itemLabel} ${i + 1} down`}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(i)}
                aria-label={`Remove ${itemLabel} ${i + 1}`}
                className="text-destructive hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => onChange([...values, ""])}
      >
        <Plus className="w-4 h-4" />
        Add {itemLabel}
      </Button>
    </div>
  );
}
