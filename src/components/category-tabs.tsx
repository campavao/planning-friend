'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentCard } from '@/components/content-card';
import type { Content } from '@/lib/supabase';

interface CategoryTabsProps {
  content: Content[];
}

export function CategoryTabs({ content }: CategoryTabsProps) {
  const meals = content.filter((c) => c.category === 'meal');
  const events = content.filter((c) => c.category === 'event');
  const dateIdeas = content.filter((c) => c.category === 'date_idea');
  const other = content.filter((c) => c.category === 'other');

  const EmptyState = ({ category }: { category: string }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4">
        {category === 'meals' && '🍳'}
        {category === 'events' && '🎉'}
        {category === 'dates' && '💕'}
        {category === 'other' && '📌'}
        {category === 'all' && '📱'}
      </div>
      <h3 className="text-xl font-semibold mb-2">No {category} saved yet</h3>
      <p className="text-muted-foreground max-w-md">
        Text a TikTok link to your number and we&apos;ll automatically categorize and save it here.
      </p>
    </div>
  );

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="glass w-full justify-start gap-1 p-1 mb-8 overflow-x-auto">
        <TabsTrigger 
          value="all" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          All ({content.length})
        </TabsTrigger>
        <TabsTrigger 
          value="meals"
          className="data-[state=active]:bg-meal/20 data-[state=active]:text-meal"
        >
          🍽️ Meals ({meals.length})
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
          💕 Date Ideas ({dateIdeas.length})
        </TabsTrigger>
        <TabsTrigger 
          value="other"
          className="data-[state=active]:bg-other/20 data-[state=active]:text-other"
        >
          📌 Other ({other.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-0">
        {content.length === 0 ? (
          <EmptyState category="all" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.map((item, index) => (
              <ContentCard key={item.id} content={item} index={index} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="meals" className="mt-0">
        {meals.length === 0 ? (
          <EmptyState category="meals" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meals.map((item, index) => (
              <ContentCard key={item.id} content={item} index={index} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="events" className="mt-0">
        {events.length === 0 ? (
          <EmptyState category="events" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((item, index) => (
              <ContentCard key={item.id} content={item} index={index} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="dates" className="mt-0">
        {dateIdeas.length === 0 ? (
          <EmptyState category="dates" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dateIdeas.map((item, index) => (
              <ContentCard key={item.id} content={item} index={index} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="other" className="mt-0">
        {other.length === 0 ? (
          <EmptyState category="other" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {other.map((item, index) => (
              <ContentCard key={item.id} content={item} index={index} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

