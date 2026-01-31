"use client";

import { Button } from "@/components/ui/button";
import type { Tag } from "@/lib/supabase";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground shrink-0">
        Filter:
      </span>
      {displayTags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`text-xs px-3 py-1 border-2 border-border font-medium transition-colors ${
              isSelected
                ? "bg-foreground text-background"
                : "bg-card hover:bg-accent"
            }`}
          >
            {tag.name}
          </button>
        );
      })}
      {hasMoreTags && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs px-3 py-1 border-2 border-border bg-accent hover:bg-accent/80 transition-colors font-mono flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              Less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              +{tags.length - MAX_COLLAPSED_TAGS} <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
      {selectedTags.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs border-2 border-destructive text-destructive hover:bg-destructive/10"
          onClick={onClear}
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
