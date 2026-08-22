"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A foldable block — equipment, ingredients, the method.
 *
 * Open by default: someone who opened a recipe wants to see the recipe, and a
 * screen of collapsed headers would make them tap three times to get back to
 * what they already had. Folding is for getting the ingredients out of the way
 * once you are cooking, which is a thing you do second, not first.
 */

interface CollapsibleSectionProps {
  icon: ElementType;
  iconClassName?: string;
  title: string;
  /** Shown as a pill in the header — usually the number of rows inside. */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  icon: Icon,
  iconClassName,
  title,
  count,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="border-t border-[var(--border)] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "w-full flex items-center gap-3 py-3.5 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg"
        )}
      >
        <span className="w-6 shrink-0 flex justify-center">
          <Icon
            className={cn("w-5 h-5", iconClassName ?? "text-muted-foreground")}
          />
        </span>
        <h3 className="heading-3 flex-1">{title}</h3>
        {typeof count === "number" && count > 0 && (
          <span className="text-[11.5px] font-semibold text-muted-foreground bg-[var(--muted)] rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>

      <div id={bodyId} hidden={!open} className="pb-4 pl-9">
        {children}
      </div>
    </div>
  );
}
