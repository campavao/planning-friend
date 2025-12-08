"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tag } from "@/lib/supabase";

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
    size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5";

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={`${sizeClasses} group cursor-default`}
        >
          {tag.name}
          {editable && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag.id);
              }}
              className="ml-1 opacity-50 hover:opacity-100"
            >
              ×
            </button>
          )}
        </Badge>
      ))}

      {editable && (
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            className={`${sizeClasses} border border-dashed`}
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            + tag
          </Button>

          {showSuggestions && (
            <>
              {/* Backdrop for mobile */}
              <div
                className="fixed inset-0 bg-black/20 z-40 md:hidden"
                onClick={() => setShowSuggestions(false)}
              />

              {/* Tag picker */}
              <div className="fixed inset-x-4 bottom-32 md:absolute md:inset-auto md:top-full md:right-0 md:bottom-auto mt-1 z-50 bg-card rounded-xl p-4 md:p-3 md:min-w-[260px] md:max-w-[300px] max-h-[350px] md:max-h-[280px] overflow-y-auto shadow-xl border border-border">
                {/* Close button for mobile */}
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="absolute top-2 right-3 text-muted-foreground hover:text-foreground text-xl md:hidden"
                >
                  ×
                </button>

                {/* Custom tag input - always at top */}
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Create new tag:
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
                        if (e.key === "Escape") {
                          setShowSuggestions(false);
                          setNewTag("");
                        }
                      }}
                      placeholder="Type tag name..."
                      className="h-9 md:h-8 text-sm md:text-xs flex-1 bg-background"
                    />
                    <Button
                      size="sm"
                      className="h-9 md:h-8 px-3"
                      onClick={handleAddCustom}
                      disabled={!newTag.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Existing tags to add */}
                {availableTags.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Your tags:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.slice(0, 12).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddExistingTag(tag.id)}
                          className="text-sm md:text-xs px-3 md:px-2 py-1 md:py-0.5 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested tags */}
                {availableSuggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Suggestions:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSuggestions.slice(0, 12).map((name) => (
                        <button
                          key={name}
                          onClick={() => handleAddSuggestion(name)}
                          className="text-sm md:text-xs px-3 md:px-2 py-1 md:py-0.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Done button for mobile */}
                <div className="mt-4 pt-3 border-t border-border md:hidden">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowSuggestions(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
