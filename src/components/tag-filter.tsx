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

  // Deterministic subset of tag IDs for collapsed view - stable across re-renders
  const randomTagIds = useMemo(() => {
    // Simple hash to get a deterministic but varied ordering per tag set
    const hash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      }
      return h;
    };
    const shuffled = [...tags].sort((a, b) => hash(a.id) - hash(b.id));
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
      <span className="text-xs font-medium text-muted-foreground shrink-0 uppercase tracking-wide">
        Filter:
      </span>
      {displayTags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              isSelected
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            {tag.name}
          </button>
        );
      })}
      {hasMoreTags && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs px-3 py-1.5 rounded-full bg-[var(--accent-light)] hover:bg-[var(--accent)] transition-colors font-medium flex items-center gap-1"
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
          className="h-7 px-2 text-xs text-destructive hover:bg-red-50"
          onClick={onClear}
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
