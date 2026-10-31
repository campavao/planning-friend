"use client";

import { AddContactButton } from "@/components/add-contact-button";
import { ContentCard } from "@/components/content-card";
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
import { filterByFavorites } from "@/lib/favorites";
import {
  Calendar,
  Coffee,
  Gift,
  Heart,
  Pin,
  Plane,
  Search,
  Smartphone,
  Star,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";

interface CategoryTabsProps {
  content: ContentWithTags[];
  allTags?: Tag[];
  /** Omitted for a read-only grid; the collection owns its items, so it passes it. */
  onToggleFavorite?: (contentId: string, next: boolean) => void;
}

export const TABS = [
  { id: "all", label: "All", icon: null },
  { id: "meals", label: "Meals", icon: Utensils, category: "meal" },
  { id: "drinks", label: "Drinks", icon: Coffee, category: "drink" },
  { id: "events", label: "Events", icon: Calendar, category: "event" },
  { id: "dates", label: "Restaurants", icon: Heart, category: "date_idea" },
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

// Structural shape rather than ContentWithTags, so the planner's add-modal —
// whose items carry optional tags — can search the same way this page does.
type Searchable = { title: string; tags?: Tag[]; data?: unknown };

function searchableText(item: Searchable) {
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
export function filterBySearch<T extends Searchable>(items: T[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => searchableText(item).includes(query));
}

// Get filtered content for a category. Every axis narrows the last one, so
// starred composes with the category tabs, the tag pills and the search box
// rather than replacing any of them.
export function getFilteredContent(content: ContentWithTags[], selectedTags: string[], category?: string, search = "", starredOnly = false) {
  let items = content;
  if (category) {
    items = content.filter((c) => c.category === category);
  }
  return filterByFavorites(
    filterBySearch(filterByTags(items, selectedTags), search),
    starredOnly
  );
}

// Toggle a tag in the selected list
export function toggleTag(prev: string[], tagId: string): string[] {
  return prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
}

// Get counts for each category
export function getCounts(content: ContentWithTags[], selectedTags: string[], search = "", starredOnly = false) {
  const count = (category?: string) =>
    getFilteredContent(content, selectedTags, category, search, starredOnly).length;

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

/** A filter pill: raised while off, filled once it's narrowing the grid. */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        active
          ? "bg-foreground text-background"
          : "surface-raised text-foreground"
      }`}
    >
      {children}
    </button>
  );
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

function ContentGrid({
  items,
  onToggleFavorite,
}: {
  items: ContentWithTags[];
  onToggleFavorite?: (contentId: string, next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
      {items.map((item, index) => (
        <ContentCard
          key={item.id}
          content={item}
          index={index}
          onToggleFavorite={
            onToggleFavorite &&
            ((next) => onToggleFavorite(item.id, next))
          }
        />
      ))}
    </div>
  );
}

export function CategoryTabs({
  content,
  allTags = [],
  onToggleFavorite,
}: CategoryTabsProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);

  const counts = getCounts(content, selectedTags, search, starredOnly);
  const hasFilters =
    selectedTags.length > 0 || search.trim().length > 0 || starredOnly;

  // What turning the star filter on would leave, given everything else that's
  // already selected — so the pill shows a reachable number, never a dead end.
  const activeCategory = TABS.find((t) => t.id === activeTab)?.category;
  const starredCount = getFilteredContent(
    content,
    selectedTags,
    activeCategory,
    search,
    true
  ).length;

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
      <TabsList className="mb-1 hide-scrollbar h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 pb-2">
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
              <span className="text-xs opacity-60">{count}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Starred and the tags in one scrolling row of filters. Starred sits
          first rather than being a tab, because it narrows whichever category
          is open instead of being one of them. */}
      <div className="-mx-4 md:mx-0 mb-4 overflow-x-auto hide-scrollbar">
        <div className="flex w-max items-center gap-2 px-4 md:px-0 py-1">
          <FilterChip
            active={starredOnly}
            onClick={() => setStarredOnly((prev) => !prev)}
          >
            <Star
              className={`size-3.5 ${starredOnly ? "fill-current" : ""}`}
            />
            Starred
            <span className="opacity-60">{starredCount}</span>
          </FilterChip>
          {allTags.length > 0 && (
            <span aria-hidden className="mx-1 h-5 w-px bg-[var(--border)]" />
          )}
          {allTags.map((tag) => (
            <FilterChip
              key={tag.id}
              active={selectedTags.includes(tag.id)}
              onClick={() =>
                setSelectedTags((prev) => toggleTag(prev, tag.id))
              }
            >
              {tag.name}
            </FilterChip>
          ))}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="inline-flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {TABS.map((tab) => {
        const items = getFilteredContent(content, selectedTags, tab.category, search, starredOnly);
        return (
          <TabsContent key={tab.id} value={tab.id}>
            {items.length === 0 ? (
              <EmptyState category={tab.id} hasFilters={hasFilters} />
            ) : (
              <>
                <p className="mb-3 text-[13px] font-medium text-muted-foreground">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </p>
                <ContentGrid items={items} onToggleFavorite={onToggleFavorite} />
              </>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
