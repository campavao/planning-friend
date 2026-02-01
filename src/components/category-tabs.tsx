"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { ContentCard } from "@/components/content-card";
import { TagFilter } from "@/components/tag-filter";
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

const TABS = [
  { id: "all", label: "All", icon: null },
  { id: "meals", label: "Meals", icon: Utensils, category: "meal" },
  { id: "drinks", label: "Drinks", icon: Coffee, category: "drink" },
  { id: "events", label: "Events", icon: Calendar, category: "event" },
  { id: "dates", label: "Dates", icon: Heart, category: "date_idea" },
  { id: "gifts", label: "Gifts", icon: Gift, category: "gift_idea" },
  { id: "travel", label: "Travel", icon: Plane, category: "travel" },
  { id: "other", label: "Other", icon: Pin, category: "other" },
];

export function CategoryTabs({ content, allTags = [] }: CategoryTabsProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Filter content by selected tags
  const filterByTags = (items: ContentWithTags[]) => {
    if (selectedTags.length === 0) return items;
    return items.filter((item) =>
      selectedTags.some((tagId) => item.tags?.some((t) => t.id === tagId))
    );
  };

  // Get filtered content for a category
  const getFilteredContent = (category?: string) => {
    let items = content;
    if (category) {
      items = content.filter((c) => c.category === category);
    }
    return filterByTags(items);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  // Get counts for each category
  const getCounts = () => {
    const filtered = filterByTags(content);
    return {
      all: filtered.length,
      meals: filterByTags(content.filter((c) => c.category === "meal")).length,
      drinks: filterByTags(content.filter((c) => c.category === "drink")).length,
      events: filterByTags(content.filter((c) => c.category === "event")).length,
      dates: filterByTags(content.filter((c) => c.category === "date_idea")).length,
      gifts: filterByTags(content.filter((c) => c.category === "gift_idea")).length,
      travel: filterByTags(content.filter((c) => c.category === "travel")).length,
      other: filterByTags(content.filter((c) => c.category === "other")).length,
    };
  };

  const counts = getCounts();

  const EmptyState = ({ category }: { category: string }) => {
    const Icon = TABS.find((t) => t.id === category)?.icon || Smartphone;

    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-center card-elevated">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
          <Icon className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="heading-3 mb-2">
          {selectedTags.length > 0
            ? `No ${category} match tags`
            : `No ${category} saved`}
        </h3>
        <p className="text-muted-foreground max-w-md mb-5 text-sm">
          {selectedTags.length > 0
            ? "Try removing some tag filters."
            : "Text a TikTok or Instagram link to save it here."}
        </p>
        {selectedTags.length === 0 && <AddContactButton variant="button" />}
      </div>
    );
  };

  const ContentGrid = ({ items }: { items: ContentWithTags[] }) => (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
      {items.map((item, index) => (
        <ContentCard key={item.id} content={item} index={index} />
      ))}
    </div>
  );

  const currentTab = TABS.find((t) => t.id === activeTab);
  const currentContent = getFilteredContent(currentTab?.category);

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="tabs-container mb-5 hide-scrollbar">
        {TABS.map((tab) => {
          const count = counts[tab.id as keyof typeof counts];
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-item ${isActive ? "active" : ""}`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              <span className="text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="mb-6 card-flat p-4">
          <TagFilter
            tags={allTags}
            selectedTags={selectedTags}
            onToggle={toggleTag}
            onClear={() => setSelectedTags([])}
          />
        </div>
      )}

      {/* Content */}
      {currentContent.length === 0 ? (
        <EmptyState category={activeTab} />
      ) : (
        <ContentGrid items={currentContent} />
      )}
    </div>
  );
}
