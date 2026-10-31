"use client";

import { useEffect, useState } from "react";

/**
 * Below this many pixels of travel the direction doesn't count. A finger
 * resting on the screen still jitters the scroll position, and without a dead
 * zone the nav flickers in and out under it.
 */
const SCROLL_THRESHOLD = 8;

/** How long after a touch, wheel or key a scroll still counts as the user's. */
const USER_SCROLL_WINDOW_MS = 250;

const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);

export interface ScrollState {
  hidden: boolean;
  /** Where the last direction change was measured from. */
  anchorY: number;
}

/**
 * The pure half of useHideOnScroll: given where the page was and where it is,
 * should the nav be hidden?
 *
 * `y` is clamped to the scrollable range first. iOS rubber-bands past both
 * ends, and the bounce back from overscrolling the bottom reads as a scroll up
 * — which would pop the nav back in every time a list was flicked to its end.
 */
export function nextScrollState(
  prev: ScrollState,
  rawY: number,
  maxY: number,
  threshold = SCROLL_THRESHOLD,
): ScrollState {
  const y = Math.min(Math.max(rawY, 0), Math.max(maxY, 0));

  // At the very top there's nothing to make room for, so the nav always shows.
  if (y <= 0) return { hidden: false, anchorY: 0 };

  const delta = y - prev.anchorY;
  if (Math.abs(delta) < threshold) return prev;

  return { hidden: delta > 0, anchorY: y };
}

/**
 * Hides a bottom bar while the page scrolls down and brings it back on the
 * first scroll up — the usual mobile pattern for giving content the full
 * screen while reading and the controls back the moment you reach for them.
 *
 * `resetKey` shows the bar again whenever it changes, so arriving on a new
 * page never starts with the nav tucked away.
 */
export function useHideOnScroll(resetKey?: unknown): boolean {
  // Tagged with the key it was measured under, so a new page reads as shown
  // without an effect having to reset it.
  const [hiddenFor, setHiddenFor] = useState<{ key: unknown } | null>(null);

  useEffect(() => {
    let state: ScrollState = { hidden: false, anchorY: window.scrollY };
    let frame = 0;
    // Only scrolling the user did counts. The planner scrolls itself to today
    // on arrival and on every date jump, and reading those as "scrolling down"
    // hid the nav before anyone had touched the page. A touch drag, wheel or
    // scroll key opens a short window; scroll events inside it — including a
    // flick's momentum, which keeps firing them — keep it open.
    let userScrollUntil = 0;
    const markUserScroll = () => {
      userScrollUntil = performance.now() + USER_SCROLL_WINDOW_MS;
    };
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) markUserScroll();
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (performance.now() > userScrollUntil) {
          // Follow the page without judging direction, so the next real
          // scroll is measured from where it actually starts.
          state = { ...state, anchorY: y };
          return;
        }
        markUserScroll();
        const maxY =
          document.documentElement.scrollHeight - window.innerHeight;
        const next = nextScrollState(state, y, maxY);
        if (next.hidden !== state.hidden) {
          setHiddenFor(next.hidden ? { key: resetKey } : null);
        }
        state = next;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchmove", markUserScroll, { passive: true });
    window.addEventListener("wheel", markUserScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchmove", markUserScroll);
      window.removeEventListener("wheel", markUserScroll);
      window.removeEventListener("keydown", onKey);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [resetKey]);

  return hiddenFor !== null && hiddenFor.key === resetKey;
}
