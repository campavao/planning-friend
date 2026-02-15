"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "meal" | "drink";

const VARIANT_CLASSES: Record<
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
  variant?: Variant;
}

export function RecipeSteps({
  ingredients = [],
  recipe = [],
  variant = "meal",
}: RecipeStepsProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleStep = (stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  };

  const classes = VARIANT_CLASSES[variant];

  return (
    <div className="space-y-6">
      {ingredients.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Ingredients</h3>
          <div className="card-flat overflow-hidden divide-y divide-[var(--border)]">
            {ingredients.map((ingredient, i) => {
              const isChecked = checkedIngredients.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleIngredient(i)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 text-left transition-colors",
                    isChecked ? classes.ingredientBg : "hover:bg-[var(--muted)]"
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors",
                      isChecked
                        ? `${classes.ingredientBorder} text-white`
                        : "border-[var(--border)]"
                    )}
                  >
                    {isChecked && <Check className="w-4 h-4" />}
                  </span>
                  <span
                    className={
                      isChecked ? "line-through text-muted-foreground" : ""
                    }
                  >
                    {ingredient}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {recipe.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Instructions</h3>
          <ol className="space-y-4">
            {recipe.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => toggleStep(i)}
                  className={cn(
                    "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-semibold transition-colors text-white",
                    completedSteps.has(i) ? classes.stepBg : "bg-[var(--primary)]"
                  )}
                >
                  {completedSteps.has(i) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    i + 1
                  )}
                </button>
                <span className="pt-2 flex-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
