"use client";

import { useState } from "react";
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
  const [showInput, setShowInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAdd = () => {
    if (newTag.trim() && onAdd) {
      onAdd(newTag.trim());
      setNewTag("");
      setShowInput(false);
    }
  };

  const tagIds = new Set(tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !tagIds.has(t.id));
  const tagNames = new Set(tags.map((t) => t.name));
  const availableSuggestions = suggestions.filter((s) => !tagNames.has(s));

  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5";

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
        <>
          {showInput ? (
            <div className="flex items-center gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setShowInput(false);
                    setNewTag("");
                  }
                }}
                placeholder="tag name"
                className="h-6 w-24 text-xs"
                autoFocus
              />
              <Button size="sm" className="h-6 px-2 text-xs" onClick={handleAdd}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setShowInput(false);
                  setNewTag("");
                }}
              >
                ×
              </Button>
            </div>
          ) : (
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
                <div className="absolute top-full left-0 mt-1 z-50 glass rounded-lg p-2 min-w-[200px] max-h-[200px] overflow-y-auto">
                  {/* Existing tags to add */}
                  {availableTags.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Your tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {availableTags.slice(0, 10).map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => {
                              onAddExisting?.(tag.id);
                              setShowSuggestions(false);
                            }}
                            className="text-xs px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80"
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested tags */}
                  {availableSuggestions.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Suggestions:</p>
                      <div className="flex flex-wrap gap-1">
                        {availableSuggestions.slice(0, 10).map((name) => (
                          <button
                            key={name}
                            onClick={() => {
                              onAdd?.(name);
                              setShowSuggestions(false);
                            }}
                            className="text-xs px-2 py-0.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary"
                          >
                            + {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom tag input */}
                  <div className="border-t border-border pt-2 mt-2">
                    <button
                      onClick={() => {
                        setShowSuggestions(false);
                        setShowInput(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      + Create custom tag...
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

