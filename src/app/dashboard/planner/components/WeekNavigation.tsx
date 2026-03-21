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
    <div className="flex items-center justify-between px-1 mb-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrev}
        className="btn-ghost w-8 h-8"
        disabled={loading}
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-2">
        <h2 className="text-base md:text-lg font-semibold">{weekRangeLabel}</h2>
        {isCurrentWeek && (
          <Badge className="bg-[var(--accent-light)] text-[var(--accent-foreground)] text-[10px] px-1.5 py-0.5">
            This Week
          </Badge>
        )}
        {sharedCount > 0 && (
          <Badge variant="date" className="text-[10px] px-1.5 py-0.5">
            <Users className="w-3 h-3" />
            {sharedCount} shared
          </Badge>
        )}
      </div>
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
  );
}
