"use client";

import { Check, CookingPot, Salad, Scroll } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./CollapsibleSection";

export type RecipeVariant = "meal" | "drink";

type Variant = RecipeVariant;

/** Exported so the edit-mode list editor wears the same colours as the view
 *  it replaces — the two are meant to read as one thing in two states. */
export const RECIPE_VARIANT_CLASSES: Record<
  Variant,
  { ingredientBg: string; ingredientBorder: string; stepBg: string }
> = {
  meal: {
    ingredientBg: "bg-[var(--meal-bg)]",
    ingredientBorder: "bg-[var(--meal)] border-[var(--meal)]",
    stepBg: "bg-[var(--meal)]",
  },
  drink: {
    ingredientBg: "bg-[var(--drink-bg)]",
    ingredientBorder: "bg-[var(--drink)] border-[var(--drink)]",
    stepBg: "bg-[var(--drink)]",
  },
};

interface RecipeStepsProps {
  ingredients?: string[];
  recipe?: string[];
  /** Appliances, bowls and utensils. Checked off before you start cooking,
   *  which is why it sits above the ingredients rather than below. */
  equipment?: string[];
  variant?: Variant;
}

/** A tickable line. Used for both equipment and ingredients — the two lists
 *  behave identically, they just answer different questions. */
function Checklist({
  items,
  checked,
  onToggle,
  classes,
}: {
  items: string[];
  checked: Set<number>;
  onToggle: (index: number) => void;
  classes: (typeof RECIPE_VARIANT_CLASSES)[Variant];
}) {
  return (
    <ul>
      {items.map((item, i) => {
        const isChecked = checked.has(i);
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onToggle(i)}
              aria-pressed={isChecked}
              className={cn(
                "w-full flex items-center gap-3 py-2 text-left rounded-lg transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              )}
            >
              <span
                className={cn(
                  "shrink-0 w-[21px] h-[21px] rounded-lg border-2 flex items-center justify-center transition-colors",
                  isChecked
                    ? `${classes.ingredientBorder} text-white`
                    : "border-[var(--border-strong)]"
                )}
              >
                {isChecked && <Check className="w-3.5 h-3.5" />}
              </span>
              <span
                className={cn(
                  "text-[14.5px] leading-snug",
                  isChecked && "line-through text-muted-foreground"
                )}
              >
                {item}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function RecipeSteps({
  ingredients = [],
  recipe = [],
  equipment = [],
  variant = "meal",
}: RecipeStepsProps) {
  const [checkedEquipment, setCheckedEquipment] = useState<Set<number>>(
    new Set()
  );
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<Set<number>>>) =>
    (index: number) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    };

  const classes = RECIPE_VARIANT_CLASSES[variant];

  if (
    equipment.length === 0 &&
    ingredients.length === 0 &&
    recipe.length === 0
  ) {
    return null;
  }

  return (
    <div>
      {equipment.length > 0 && (
        <CollapsibleSection
          icon={CookingPot}
          iconClassName="text-[var(--other)]"
          title="Equipment"
          count={equipment.length}
        >
          <Checklist
            items={equipment}
            checked={checkedEquipment}
            onToggle={toggle(setCheckedEquipment)}
            classes={classes}
          />
        </CollapsibleSection>
      )}

      {ingredients.length > 0 && (
        <CollapsibleSection
          icon={Salad}
          iconClassName={
            variant === "meal" ? "text-[var(--meal)]" : "text-[var(--drink)]"
          }
          title="Ingredients"
          count={ingredients.length}
        >
          <Checklist
            items={ingredients}
            checked={checkedIngredients}
            onToggle={toggle(setCheckedIngredients)}
            classes={classes}
          />
        </CollapsibleSection>
      )}

      {recipe.length > 0 && (
        <CollapsibleSection
          icon={Scroll}
          iconClassName="text-[var(--primary)]"
          title={variant === "drink" ? "Method" : "Recipe"}
          count={recipe.length}
        >
          <ol>
            {recipe.map((step, i) => {
              const done = completedSteps.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(setCompletedSteps)(i)}
                    aria-pressed={done}
                    className={cn(
                      "w-full flex items-start gap-3 py-2.5 text-left rounded-lg transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 w-[26px] h-[26px] rounded-lg flex items-center justify-center",
                        "text-xs font-bold text-white transition-colors",
                        done ? classes.stepBg : "bg-[var(--primary)]"
                      )}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "text-[14.5px] leading-relaxed pt-0.5 flex-1",
                        done && "text-muted-foreground"
                      )}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </CollapsibleSection>
      )}
    </div>
  );
}
