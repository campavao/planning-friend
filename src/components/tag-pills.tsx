"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Tag } from "@/lib/supabase";
import { Plus, X } from "lucide-react";

interface TagPillsProps {
  tags: Tag[];
  editable?: boolean;
  suggestions?: string[];
  allTags?: Tag[];
  onAdd?: (name: string) => void;
  onRemove?: (tagId: string) => void;
  onAddExisting?: (tagId: string) => void;
  size?: "sm" | "md";
}

export function TagPills({
  tags,
  editable = false,
  suggestions = [],
  allTags = [],
  onAdd,
  onRemove,
  onAddExisting,
  size = "md",
}: TagPillsProps) {
  const [newTag, setNewTag] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddCustom = () => {
    if (newTag.trim() && onAdd) {
      onAdd(newTag.trim());
      setNewTag("");
      // Keep popup open, focus back on input
      inputRef.current?.focus();
    }
  };

  const handleAddSuggestion = (name: string) => {
    onAdd?.(name);
    // Keep popup open for adding more
  };

  const handleAddExistingTag = (tagId: string) => {
    onAddExisting?.(tagId);
    // Keep popup open for adding more
  };

  // Focus input when popup opens
  useEffect(() => {
    if (showSuggestions) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showSuggestions]);

  const tagIds = new Set(tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !tagIds.has(t.id));
  const tagNames = new Set(tags.map((t) => t.name.toLowerCase()));
  const availableSuggestions = suggestions.filter(
    (s) => !tagNames.has(s.toLowerCase())
  );

  const sizeClasses =
    size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1.5";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="accent"
          className={`${sizeClasses} font-medium`}
        >
          {tag.name}
          {editable && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag.id);
              }}
              className="hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </Badge>
      ))}

      {editable && (
        <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
          <PopoverTrigger asChild>
            <Badge asChild variant="outline" className={`${sizeClasses} font-medium`}>
              <button className="border-2 border-dashed hover:bg-[var(--muted)] transition-colors">
                <Plus className="w-3 h-3" />
                Tag
              </button>
            </Badge>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-[min(20rem,calc(100vw-2rem))] max-h-[min(350px,var(--radix-popover-content-available-height))] overflow-y-auto p-4 md:p-3"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {/* Custom tag input */}
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Create Tag
              </p>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                  placeholder="Tag name..."
                  className="h-9 md:h-8 text-sm md:text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-9 md:h-8 px-3 text-xs"
                  onClick={handleAddCustom}
                  disabled={!newTag.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Existing tags */}
            {availableTags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Your Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 12).map((tag) => (
                    <Badge key={tag.id} asChild variant="muted">
                      <button
                        onClick={() => handleAddExistingTag(tag.id)}
                        className="text-sm md:text-xs font-medium hover:bg-[var(--border)] transition-colors"
                      >
                        {tag.name}
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {availableSuggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.slice(0, 12).map((name) => (
                    <Badge
                      key={name}
                      asChild
                      className="bg-[var(--primary)]/10 text-[var(--primary)]"
                    >
                      <button
                        onClick={() => handleAddSuggestion(name)}
                        className="text-sm md:text-xs font-medium hover:bg-[var(--primary)]/20 transition-colors"
                      >
                        + {name}
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Done button for mobile */}
            <div className="mt-4 pt-3 border-t border-[var(--border)] md:hidden">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowSuggestions(false)}
              >
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
