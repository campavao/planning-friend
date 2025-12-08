"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentCard } from "@/components/content-card";
import { TagFilter } from "@/components/tag-filter";
import type { ContentWithTags, Tag } from "@/lib/supabase";

interface CategoryTabsProps {
  content: ContentWithTags[];
  allTags?: Tag[];
}

export function CategoryTabs({ content, allTags = [] }: CategoryTabsProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Filter content by selected tags
  const filterByTags = (items: ContentWithTags[]) => {
    if (selectedTags.length === 0) return items;
    return items.filter((item) =>
      selectedTags.some((tagId) => item.tags?.some((t) => t.id === tagId))
    );
  };

  const filteredContent = filterByTags(content);
  const meals = filterByTags(content.filter((c) => c.category === "meal"));
  const drinks = filterByTags(content.filter((c) => c.category === "drink"));
  const events = filterByTags(content.filter((c) => c.category === "event"));
  const dateIdeas = filterByTags(
    content.filter((c) => c.category === "date_idea")
  );
  const giftIdeas = filterByTags(
    content.filter((c) => c.category === "gift_idea")
  );
  const travel = filterByTags(content.filter((c) => c.category === "travel"));
  const other = filterByTags(content.filter((c) => c.category === "other"));

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const EmptyState = ({ category }: { category: string }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4">
        {category === "meals" && "🍳"}
        {category === "drinks" && "🍹"}
        {category === "events" && "🎉"}
        {category === "dates" && "💕"}
        {category === "gifts" && "🎁"}
        {category === "travel" && "✈️"}
        {category === "other" && "📌"}
        {category === "all" && "📱"}
      </div>
      <h3 className="text-xl font-semibold mb-2">
        {selectedTags.length > 0
          ? `No ${category} match selected tags`
          : `No ${category} saved yet`}
      </h3>
      <p className="text-muted-foreground max-w-md">
        {selectedTags.length > 0
          ? "Try removing some tag filters."
          : "Text a TikTok link to your number and we'll automatically categorize and save it here."}
      </p>
    </div>
  );

  const ContentGrid = ({ items }: { items: ContentWithTags[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item, index) => (
        <ContentCard key={item.id} content={item} index={index} />
      ))}
    </div>
  );

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="glass w-full justify-start gap-1 p-1 mb-4 overflow-x-auto flex-wrap h-auto">
        <TabsTrigger
          value="all"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          All ({filteredContent.length})
        </TabsTrigger>
        <TabsTrigger
          value="meals"
          className="data-[state=active]:bg-meal/20 data-[state=active]:text-meal"
        >
          🍽️ Meals ({meals.length})
        </TabsTrigger>
        <TabsTrigger
          value="drinks"
          className="data-[state=active]:bg-drink/20 data-[state=active]:text-drink"
        >
          🍹 Drinks ({drinks.length})
        </TabsTrigger>
        <TabsTrigger
          value="events"
          className="data-[state=active]:bg-event/20 data-[state=active]:text-event"
        >
          🎉 Events ({events.length})
        </TabsTrigger>
        <TabsTrigger
          value="dates"
          className="data-[state=active]:bg-date/20 data-[state=active]:text-date"
        >
          💕 Dates ({dateIdeas.length})
        </TabsTrigger>
        <TabsTrigger
          value="gifts"
          className="data-[state=active]:bg-gift/20 data-[state=active]:text-gift"
        >
          🎁 Gifts ({giftIdeas.length})
        </TabsTrigger>
        <TabsTrigger
          value="travel"
          className="data-[state=active]:bg-travel/20 data-[state=active]:text-travel"
        >
          ✈️ Travel ({travel.length})
        </TabsTrigger>
        <TabsTrigger
          value="other"
          className="data-[state=active]:bg-other/20 data-[state=active]:text-other"
        >
          📌 Other ({other.length})
        </TabsTrigger>
      </TabsList>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="mb-6">
          <TagFilter
            tags={allTags}
            selectedTags={selectedTags}
            onToggle={toggleTag}
            onClear={() => setSelectedTags([])}
          />
        </div>
      )}

      <TabsContent value="all" className="mt-0">
        {filteredContent.length === 0 ? (
          <EmptyState category="all" />
        ) : (
          <ContentGrid items={filteredContent} />
        )}
      </TabsContent>

      <TabsContent value="meals" className="mt-0">
        {meals.length === 0 ? (
          <EmptyState category="meals" />
        ) : (
          <ContentGrid items={meals} />
        )}
      </TabsContent>

      <TabsContent value="drinks" className="mt-0">
        {drinks.length === 0 ? (
          <EmptyState category="drinks" />
        ) : (
          <ContentGrid items={drinks} />
        )}
      </TabsContent>

      <TabsContent value="events" className="mt-0">
        {events.length === 0 ? (
          <EmptyState category="events" />
        ) : (
          <ContentGrid items={events} />
        )}
      </TabsContent>

      <TabsContent value="dates" className="mt-0">
        {dateIdeas.length === 0 ? (
          <EmptyState category="dates" />
        ) : (
          <ContentGrid items={dateIdeas} />
        )}
      </TabsContent>

      <TabsContent value="gifts" className="mt-0">
        {giftIdeas.length === 0 ? (
          <EmptyState category="gifts" />
        ) : (
          <ContentGrid items={giftIdeas} />
        )}
      </TabsContent>

      <TabsContent value="travel" className="mt-0">
        {travel.length === 0 ? (
          <EmptyState category="travel" />
        ) : (
          <ContentGrid items={travel} />
        )}
      </TabsContent>

      <TabsContent value="other" className="mt-0">
        {other.length === 0 ? (
          <EmptyState category="other" />
        ) : (
          <ContentGrid items={other} />
        )}
      </TabsContent>
    </Tabs>
  );
}
