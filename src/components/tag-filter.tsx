"use client";

import { Button } from "@/components/ui/button";
import type { Tag } from "@/lib/supabase";
import { useMemo, useState } from "react";

const MAX_COLLAPSED_TAGS = 7;

interface TagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  onToggle: (tagId: string) => void;
  onClear: () => void;
}

export function TagFilter({
  tags,
  selectedTags,
  onToggle,
  onClear,
}: TagFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Randomized tag IDs for collapsed view - stable unless tags array changes
  const randomTagIds = useMemo(() => {
    const shuffled = [...tags].sort(() => Math.random() - 0.5);
    return new Set(shuffled.slice(0, MAX_COLLAPSED_TAGS).map((t) => t.id));
  }, [tags]);

  // Collapsed tags: show random selection + any selected tags not in random set
  const collapsedTags = useMemo(() => {
    const randomTags = tags.filter((t) => randomTagIds.has(t.id));
    const selectedNotInRandom = tags.filter(
      (t) => selectedTags.includes(t.id) && !randomTagIds.has(t.id)
    );
    return [...selectedNotInRandom, ...randomTags];
  }, [tags, randomTagIds, selectedTags]);

  // Alphabetically sorted tags for expanded view
  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => a.name.localeCompare(b.name));
  }, [tags]);

  if (tags.length === 0) return null;

  const displayTags = isExpanded ? sortedTags : collapsedTags;
  const hasMoreTags = tags.length > MAX_COLLAPSED_TAGS;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs text-muted-foreground shrink-0">
        Filter by tag:
      </span>
      {displayTags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            {tag.name}
          </button>
        );
      })}
      {hasMoreTags && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs px-2 py-0.5 rounded-full bg-washi-blue/30 hover:bg-washi-blue/50 transition-colors text-foreground/70"
        >
          {isExpanded
            ? "See less"
            : `+${tags.length - MAX_COLLAPSED_TAGS} more`}
        </button>
      )}
      {selectedTags.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={onClear}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
