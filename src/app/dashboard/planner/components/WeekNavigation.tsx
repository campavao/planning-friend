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
    <div className="card-elevated p-4 mb-6 flex items-center justify-between">
      <Button
        variant="ghost"
        onClick={onPrev}
        className="btn-ghost"
        disabled={loading}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline ml-2">Prev</span>
      </Button>
      <div className="text-center">
        <h2 className="text-lg md:text-xl font-semibold">{weekRangeLabel}</h2>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          {isCurrentWeek && (
            <Badge className="bg-[var(--accent-light)] text-[var(--accent-foreground)]">
              This Week
            </Badge>
          )}
          {sharedCount > 0 && (
            <Badge variant="date">
              <Users className="w-3 h-3" />
              {sharedCount} shared
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        onClick={onNext}
        className="btn-ghost"
        disabled={loading}
      >
        <span className="hidden sm:inline mr-2">Next</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
