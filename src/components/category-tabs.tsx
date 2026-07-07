"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { ContentCard } from "@/components/content-card";
import { TagFilter } from "@/components/tag-filter";
import { Card } from "@/components/ui/card";
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
  Smartphone,
  Utensils,
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

// Get filtered content for a category
export function getFilteredContent(content: ContentWithTags[], selectedTags: string[], category?: string) {
  let items = content;
  if (category) {
    items = content.filter((c) => c.category === category);
  }
  return filterByTags(items, selectedTags);
}

// Toggle a tag in the selected list
export function toggleTag(prev: string[], tagId: string): string[] {
  return prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
}

// Get counts for each category
export function getCounts(content: ContentWithTags[], selectedTags: string[]) {
  const filtered = filterByTags(content, selectedTags);
  return {
    all: filtered.length,
    meals: filterByTags(content.filter((c) => c.category === "meal"), selectedTags).length,
    drinks: filterByTags(content.filter((c) => c.category === "drink"), selectedTags).length,
    events: filterByTags(content.filter((c) => c.category === "event"), selectedTags).length,
    dates: filterByTags(content.filter((c) => c.category === "date_idea"), selectedTags).length,
    gifts: filterByTags(content.filter((c) => c.category === "gift_idea"), selectedTags).length,
    travel: filterByTags(content.filter((c) => c.category === "travel"), selectedTags).length,
    other: filterByTags(content.filter((c) => c.category === "other"), selectedTags).length,
  };
}

function EmptyState({ category, hasTagFilters }: { category: string; hasTagFilters: boolean }) {
  const Icon = TABS.find((t) => t.id === category)?.icon || Smartphone;

  return (
    <Card className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="heading-3 mb-2">
        {hasTagFilters
          ? `No ${category} match tags`
          : `No ${category} saved`}
      </h3>
      <p className="text-muted-foreground max-w-md mb-5 text-sm">
        {hasTagFilters
          ? "Try removing some tag filters."
          : "Text a TikTok or Instagram link to save it here."}
      </p>
      {!hasTagFilters && <AddContactButton variant="button" />}
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

  const counts = getCounts(content, selectedTags);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-0">
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
        const items = getFilteredContent(content, selectedTags, tab.category);
        return (
          <TabsContent key={tab.id} value={tab.id}>
            {items.length === 0 ? (
              <EmptyState
                category={tab.id}
                hasTagFilters={selectedTags.length > 0}
              />
            ) : (
              <ContentGrid items={items} />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
