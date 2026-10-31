"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/** Matches duration-300 below. */
const SLIDE_MS = 300;

/**
 * Slides its children open and shut by animating a grid row between 0fr and
 * 1fr — the one way to transition to an element's natural height in CSS
 * without measuring it.
 *
 * The children mount when opening and unmount once the close has played, so a
 * planner full of collapsed cards isn't also carrying every card's details.
 * Opening mounts at 0fr and flips to 1fr a frame later; flipping in the same
 * frame as the mount would skip the transition entirely.
 */
export function SlideOpen({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);

  useEffect(() => {
    if (open) {
      // Two frames: the first lets the 0fr state paint, the second animates.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        setMounted(true);
        inner = requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    const collapse = requestAnimationFrame(() => setExpanded(false));
    const unmount = setTimeout(() => setMounted(false), SLIDE_MS);
    return () => {
      cancelAnimationFrame(collapse);
      clearTimeout(unmount);
    };
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      // Closing content is still in the DOM for the length of the slide;
      // inert keeps its links out of the tab order and away from taps.
      inert={!open}
    >
      <div className={cn("min-h-0 overflow-hidden", className)}>
        {children}
      </div>
    </div>
  );
}
