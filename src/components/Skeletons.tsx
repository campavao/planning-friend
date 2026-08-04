// Shared skeleton placeholders shown while a page's data loads, so navigating
// between tabs reveals the page's shape immediately instead of a blank
// full-screen spinner.

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-32 md:h-40 rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Placeholder for a horizontal card rail on the dashboard. */
export function CardRailSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-3 overflow-hidden px-4 md:px-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-36 md:w-44 shrink-0">
            <Card className="overflow-hidden">
              <Skeleton className="aspect-square rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 flex flex-row items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}
