"use client";

import { useEffect, useState } from "react";

/**
 * How much of the bottom of the layout viewport the on-screen keyboard is
 * covering, in px. 0 when it is closed or the browser has no visualViewport.
 *
 * A `position: fixed; bottom: 0` drawer sits on the *layout* viewport, which
 * iOS does not shrink when the keyboard opens — so the drawer, and whatever
 * you are typing into, slides under the keys. Adding this to the drawer's
 * `bottom` keeps it resting on the keyboard instead.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // Small deltas are browser chrome (URL bar) resizing, not a keyboard.
      setInset(covered > 80 ? Math.round(covered) : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
