"use client";

import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WeekNavigationProps {
  weekRangeLabel: string;
  isCurrentWeek: boolean;
  sharedCount: number;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
}

export function WeekNavigation({
  weekRangeLabel,
  isCurrentWeek,
  sharedCount,
  onPrev,
  onNext,
  loading = false,
}: WeekNavigationProps) {
  return (
    <div className="mb-3 px-1">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          className="btn-ghost w-8 h-8"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">{weekRangeLabel}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          className="btn-ghost w-8 h-8"
          disabled={loading}
        >
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      {(isCurrentWeek || sharedCount > 0) && (
        <div className="flex items-center justify-center gap-2 mt-1">
          {isCurrentWeek && (
            <Badge className="bg-[var(--accent-light)] text-[var(--accent-foreground)] text-xs px-2 py-0.5">
              This Week
            </Badge>
          )}
          {sharedCount > 0 && (
            <Badge variant="date" className="text-xs px-2 py-0.5">
              <Users className="w-3 h-3" />
              {sharedCount} shared
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
