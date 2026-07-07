// Shared skeleton placeholders shown while a page's data loads, so navigating
// between tabs reveals the page's shape immediately instead of a blank
// full-screen spinner.

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-elevated overflow-hidden">
          <div className="skeleton h-32 md:h-40 rounded-none" />
          <div className="p-3 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="skeleton w-8 h-8 mx-auto mb-1.5 rounded-lg" />
          <div className="skeleton h-5 w-6 mx-auto mb-1" />
          <div className="skeleton h-2.5 w-10 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-elevated p-4 flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
