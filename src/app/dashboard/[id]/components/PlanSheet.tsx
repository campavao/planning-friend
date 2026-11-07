"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { TimeChips } from "@/components/time-chips";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { WeekStrip } from "@/components/week-strip";
import {
  DEFAULT_PLAN_TIME,
  formatTimeLabel,
  plannedDateFor,
  shortDayLabel,
} from "@/lib/plan-time";
import { formatDateString, getWeekStartDay } from "@/lib/utils";

/**
 * Put this item on a day: a week strip, a time, and one button that says
 * exactly what will happen. Replaces a fourteen-row list of days with no time.
 *
 * Sends `plannedDate` and lets the server derive the week from it, through the
 * same helper the planner uses, so an item added here lands where one added
 * there would.
 */
export function PlanSheet({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  onPlanned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  /** After a successful add — the page refreshes its "coming up" line. */
  onPlanned: () => void;
}) {
  const todayKey = formatDateString(new Date());
  const [day, setDay] = useState(todayKey);
  const [time, setTime] = useState(DEFAULT_PLAN_TIME);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [weekStartDay] = useState(() => getWeekStartDay());

  const label = `${shortDayLabel(day)} · ${formatTimeLabel(time)}`;

  const add = async () => {
    const plannedDate = plannedDateFor(day, time);
    if (!plannedDate) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, plannedDate, source: "manual" }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setStatus("done");
      onPlanned();
      // Left open a moment so the confirmation is seen.
      setTimeout(() => {
        onOpenChange(false);
        setStatus("idle");
      }, 1200);
    } catch (error) {
      console.error("Failed to add to planner:", error);
      setStatus("error");
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setStatus("idle");
        onOpenChange(next);
      }}
      title="Add to planner"
      subtitle={contentTitle}
      top={
        <>
          <WeekStrip
            value={day}
            onChange={(next) => {
              setDay(next);
              setStatus("idle");
            }}
            weekStartDay={weekStartDay}
            minDate={todayKey}
          />
          <TimeChips
            value={time}
            onChange={(next) => {
              setTime(next);
              setStatus("idle");
            }}
          />
        </>
      }
      footer={
        <div>
          {status === "error" && (
            <p className="pb-2 text-center text-sm text-destructive">
              Couldn&apos;t add it — try again
            </p>
          )}
          <Button
            className="w-full"
            onClick={add}
            disabled={status === "saving" || status === "done"}
          >
            {status === "done" ? (
              <>
                <Check className="size-4" />
                Added to {shortDayLabel(day)}
              </>
            ) : status === "saving" ? (
              "Adding…"
            ) : (
              `Add to ${label}`
            )}
          </Button>
        </div>
      }
    />
  );
}
