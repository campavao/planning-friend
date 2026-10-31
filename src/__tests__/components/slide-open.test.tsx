/**
 * @jest-environment jsdom
 */

/**
 * The slide is CSS; what's worth pinning is the lifecycle around it: content
 * appears the moment it opens, is out of reach while closing, and leaves the
 * DOM once the close has played.
 */

import { SlideOpen } from "@/components/slide-open";
import { act, render, screen } from "@testing-library/react";

function frames() {
  // Two frames: SlideOpen mounts at 0fr, then flips to 1fr a frame later.
  act(() => {
    jest.advanceTimersByTime(40);
  });
}

describe("SlideOpen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders nothing while closed", () => {
    render(<SlideOpen open={false}>Details</SlideOpen>);
    expect(screen.queryByText("Details")).toBeNull();
  });

  it("shows its content as soon as it opens", () => {
    const { rerender } = render(<SlideOpen open={false}>Details</SlideOpen>);
    rerender(<SlideOpen open>Details</SlideOpen>);

    expect(screen.getByText("Details")).toBeTruthy();
  });

  it("keeps closing content inert until the slide finishes, then removes it", () => {
    const { rerender } = render(<SlideOpen open>Details</SlideOpen>);
    frames();

    rerender(<SlideOpen open={false}>Details</SlideOpen>);
    const sliding = screen.getByText("Details").parentElement!;
    expect(sliding.hasAttribute("inert")).toBe(true);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByText("Details")).toBeNull();
  });
});
