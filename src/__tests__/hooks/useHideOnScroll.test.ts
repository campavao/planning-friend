/**
 * When the bottom nav hides. Worth pinning because every rule here exists to
 * stop a specific flicker: finger jitter, the rubber-band past either end, and
 * the top of the page, where there's nothing to make room for.
 */

import { nextScrollState, type ScrollState } from "@/hooks/useHideOnScroll";

const MAX = 2000;
const shown: ScrollState = { hidden: false, anchorY: 100 };

describe("nextScrollState", () => {
  it("hides on a scroll down and shows on a scroll up", () => {
    const down = nextScrollState(shown, 200, MAX);
    expect(down.hidden).toBe(true);

    const up = nextScrollState(down, 150, MAX);
    expect(up.hidden).toBe(false);
  });

  it("ignores movement inside the dead zone", () => {
    expect(nextScrollState(shown, 105, MAX)).toBe(shown);
    expect(nextScrollState(shown, 95, MAX)).toBe(shown);
  });

  it("always shows at the top of the page", () => {
    const hidden: ScrollState = { hidden: true, anchorY: 300 };
    expect(nextScrollState(hidden, 0, MAX).hidden).toBe(false);
    // iOS overscroll past the top reports a negative position.
    expect(nextScrollState(hidden, -40, MAX).hidden).toBe(false);
  });

  it("doesn't read the bounce back from the bottom as a scroll up", () => {
    const atBottom: ScrollState = { hidden: true, anchorY: MAX };
    // Overscrolled past the end, then settling back to it.
    const over = nextScrollState(atBottom, MAX + 60, MAX);
    expect(nextScrollState(over, MAX, MAX).hidden).toBe(true);
  });
});
