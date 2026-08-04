"use client";

import { useEffect, useState } from "react";

/**
 * The slide-in is a first-impression flourish, so it plays once per group for
 * as long as the app is loaded. Switching tabs unmounts and remounts the same
 * components, and replaying the animation every time reads as the page
 * rebuilding itself rather than as polish.
 *
 * Grouped rather than global so each kind of element still gets its own first
 * appearance — cards animate the first time cards are shown, whether or not
 * some other element animated earlier.
 */
const played = new Set<string>();

export function useSlideIn(group: string): boolean {
  // Read at mount: everything in the first batch sees an unplayed group and
  // animates together; anything mounting later does not.
  const [play] = useState(() => !played.has(group));

  useEffect(() => {
    played.add(group);
  }, [group]);

  return play;
}
