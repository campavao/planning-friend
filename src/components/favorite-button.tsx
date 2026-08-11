"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  /** "overlay" floats over a card; "header" sits in a row of icon buttons. */
  variant?: "overlay" | "header";
  className?: string;
}

export function FavoriteButton({
  isFavorite,
  onToggle,
  variant = "header",
  className,
}: FavoriteButtonProps) {
  const label = isFavorite ? "Remove from starred" : "Star this item";

  return (
    <Button
      type="button"
      variant="ghost"
      size={variant === "overlay" ? "icon-sm" : "icon"}
      onClick={(e) => {
        // A card wraps its whole tile in a link, so the star has to swallow
        // the click rather than let it navigate to the detail page.
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={isFavorite}
      aria-label={label}
      title={label}
      className={cn(
        variant === "overlay" &&
          "rounded-full bg-white/90 shadow-sm hover:bg-white",
        className
      )}
    >
      <Star
        className={cn(
          "w-4 h-4",
          isFavorite
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
