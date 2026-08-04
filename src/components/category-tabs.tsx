"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { ContentCard } from "@/components/content-card";
import { TagFilter } from "@/components/tag-filter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ContentWithTags, Tag } from "@/lib/supabase";
import {
  Calendar,
  Coffee,
  Gift,
  Heart,
  Pin,
  Plane,
  Search,
  Smartphone,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";

interface CategoryTabsProps {
  content: ContentWithTags[];
  allTags?: Tag[];
}

export const TABS = [
  { id: "all", label: "All", icon: null },
  { id: "meals", label: "Meals", icon: Utensils, category: "meal" },
  { id: "drinks", label: "Drinks", icon: Coffee, category: "drink" },
  { id: "events", label: "Events", icon: Calendar, category: "event" },
  { id: "dates", label: "Dates", icon: Heart, category: "date_idea" },
  { id: "gifts", label: "Gifts", icon: Gift, category: "gift_idea" },
  { id: "travel", label: "Travel", icon: Plane, category: "travel" },
  { id: "other", label: "Other", icon: Pin, category: "other" },
];

// Filter content by selected tags
export function filterByTags(items: ContentWithTags[], selectedTags: string[]) {
  if (selectedTags.length === 0) return items;
  return items.filter((item) =>
    selectedTags.some((tagId) => item.tags?.some((t) => t.id === tagId))
  );
}

// The `data` fields worth matching on — the details someone would actually
// remember a saved item by when they can't recall its title.
const SEARCHABLE_DATA_FIELDS = [
  "name",
  "description",
  "location",
  "destination_city",
  "destination_country",
  "ingredients",
];

function searchableText(item: ContentWithTags) {
  const parts = [item.title, ...(item.tags?.map((t) => t.name) || [])];
  const data = item.data as Record<string, unknown> | undefined;

  for (const field of SEARCHABLE_DATA_FIELDS) {
    const value = data?.[field];
    if (typeof value === "string") {
      parts.push(value);
    } else if (Array.isArray(value)) {
      parts.push(value.filter((v) => typeof v === "string").join(" "));
    }
  }

  return parts.join(" ").toLowerCase();
}

// Filter content by a free-text query
export function filterBySearch(items: ContentWithTags[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => searchableText(item).includes(query));
}

// Get filtered content for a category
export function getFilteredContent(content: ContentWithTags[], selectedTags: string[], category?: string, search = "") {
  let items = content;
  if (category) {
    items = content.filter((c) => c.category === category);
  }
  return filterBySearch(filterByTags(items, selectedTags), search);
}

// Toggle a tag in the selected list
export function toggleTag(prev: string[], tagId: string): string[] {
  return prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
}

// Get counts for each category
export function getCounts(content: ContentWithTags[], selectedTags: string[], search = "") {
  const count = (category?: string) =>
    getFilteredContent(content, selectedTags, category, search).length;

  return {
    all: count(),
    meals: count("meal"),
    drinks: count("drink"),
    events: count("event"),
    dates: count("date_idea"),
    gifts: count("gift_idea"),
    travel: count("travel"),
    other: count("other"),
  };
}

function EmptyState({ category, hasFilters }: { category: string; hasFilters: boolean }) {
  const Icon = TABS.find((t) => t.id === category)?.icon || Smartphone;

  return (
    <Card className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="heading-3 mb-2">
        {hasFilters
          ? `No ${category} match your filters`
          : `No ${category} saved`}
      </h3>
      <p className="text-muted-foreground max-w-md mb-5 text-sm">
        {hasFilters
          ? "Try a different search or clearing some filters."
          : "Text a TikTok or Instagram link to save it here."}
      </p>
      {!hasFilters && <AddContactButton variant="button" />}
    </Card>
  );
}

function ContentGrid({ items }: { items: ContentWithTags[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
      {items.map((item, index) => (
        <ContentCard key={item.id} content={item} index={index} />
      ))}
    </div>
  );
}

export function CategoryTabs({ content, allTags = [] }: CategoryTabsProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const counts = getCounts(content, selectedTags, search);
  const hasFilters = selectedTags.length > 0 || search.trim().length > 0;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-0">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearch("");
          }}
          placeholder="Search your collection..."
          aria-label="Search your collection"
          className="pl-10 pr-10 text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <TabsList className="mb-5 hide-scrollbar h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 pb-2">
        {TABS.map((tab) => {
          const count = counts[tab.id as keyof typeof counts];
          const Icon = tab.icon;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="h-auto flex-none gap-2 rounded-full border-none px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-all hover:bg-[var(--muted)] hover:text-foreground data-[state=active]:bg-[var(--primary)] data-[state=active]:text-[var(--primary-foreground)] data-[state=active]:shadow-none"
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              <span className="text-xs opacity-70">({count})</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <Card className="mb-6 border border-[var(--border)] p-4 shadow-none">
          <TagFilter
            tags={allTags}
            selectedTags={selectedTags}
            onToggle={(tagId) => setSelectedTags((prev) => toggleTag(prev, tagId))}
            onClear={() => setSelectedTags([])}
          />
        </Card>
      )}

      {/* Content */}
      {TABS.map((tab) => {
        const items = getFilteredContent(content, selectedTags, tab.category, search);
        return (
          <TabsContent key={tab.id} value={tab.id}>
            {items.length === 0 ? (
              <EmptyState category={tab.id} hasFilters={hasFilters} />
            ) : (
              <ContentGrid items={items} />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
