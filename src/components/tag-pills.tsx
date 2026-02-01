"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <span
          key={tag.id}
          className={`${sizeClasses} bg-[var(--accent-light)] rounded-full font-medium inline-flex items-center gap-1.5`}
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
        </span>
      ))}

      {editable && (
        <div className="relative">
          <button
            className={`${sizeClasses} border-2 border-dashed border-[var(--border)] hover:bg-[var(--muted)] rounded-full font-medium inline-flex items-center gap-1 transition-colors`}
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            <Plus className="w-3 h-3" />
            Tag
          </button>

          {showSuggestions && (
            <>
              {/* Backdrop for mobile */}
              <div
                className="fixed inset-0 modal-backdrop z-40 md:hidden"
                onClick={() => setShowSuggestions(false)}
              />

              {/* Tag picker */}
              <div className="fixed inset-x-4 bottom-32 md:absolute md:inset-auto md:top-full md:right-0 md:bottom-auto mt-1 z-50 bg-[var(--card)] rounded-2xl shadow-xl p-4 md:p-3 md:min-w-[280px] md:max-w-[320px] max-h-[350px] md:max-h-[300px] overflow-y-auto">
                {/* Close button for mobile */}
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground md:hidden"
                >
                  <X className="w-5 h-5" />
                </button>

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
                        if (e.key === "Escape") {
                          setShowSuggestions(false);
                          setNewTag("");
                        }
                      }}
                      placeholder="Tag name..."
                      className="input-modern h-9 md:h-8 text-sm md:text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="btn-primary h-9 md:h-8 px-3 text-xs"
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
                        <button
                          key={tag.id}
                          onClick={() => handleAddExistingTag(tag.id)}
                          className="text-sm md:text-xs px-3 md:px-2.5 py-1.5 md:py-1 rounded-full bg-[var(--muted)] hover:bg-[var(--border)] transition-colors"
                        >
                          {tag.name}
                        </button>
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
                        <button
                          key={name}
                          onClick={() => handleAddSuggestion(name)}
                          className="text-sm md:text-xs px-3 md:px-2.5 py-1.5 md:py-1 rounded-full bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] transition-colors"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Done button for mobile */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] md:hidden">
                  <Button
                    variant="outline"
                    className="w-full btn-outline"
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
