"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImageIcon, X } from "lucide-react";
import Image from "next/image";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const MAX_ZOOM = 5;
// A wheel notch is roughly 100px of deltaY; dividing by this turns that into a
// ~1.4x step, which reads as one step of zoom rather than a jump.
const WHEEL_ZOOM_DIVISOR = 300;
// Under this much travel a press counts as a tap rather than a drag or a flick.
const TAP_SLOP_PX = 8;

interface SourcePhotoDialogProps {
  imageUrl: string;
  // Alt text only. Several items can come out of one photo, so this says which
  // item you opened the photo from, not that the photo belongs to it alone.
  itemTitle: string;
}

/**
 * The viewer itself, driven by its caller.
 *
 * Split out from the button below so the redesigned item view can open the same
 * pinch-zoom viewer by tapping the thumbnail — the trigger changed, the viewer
 * did not, and reimplementing the gesture handling for a second entry point
 * would have been the wrong kind of duplication.
 */
export function PhotoViewerDialog({
  open,
  onOpenChange,
  imageUrl,
  itemTitle,
  title = "Original photo",
  trigger,
}: SourcePhotoDialogProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** The element that opens the viewer. Passed through DialogTrigger rather
   *  than wired up by the caller so Radix knows where to put focus back on
   *  close — without it, dismissing the viewer drops focus onto the body and
   *  a keyboard user loses their place on the page. */
  trigger?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {/* Most of DialogContent's card styling is overridden here: this one is a
          full-bleed viewer, not a panel floating in the middle of the page. */}
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="block top-0 left-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none sm:max-w-none max-h-none gap-0 rounded-none p-0 shadow-none overflow-y-hidden bg-black/95"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <PhotoViewport
          imageUrl={imageUrl}
          itemTitle={itemTitle}
          onDismiss={() => onOpenChange(false)}
        />
        <DialogClose className="absolute top-4 right-4 z-10 rounded-full bg-black/40 p-2 text-white/90 transition-colors hover:bg-black/60 outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X className="w-5 h-5" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export function SourcePhotoDialog({
  imageUrl,
  itemTitle,
}: SourcePhotoDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <PhotoViewerDialog
      open={open}
      onOpenChange={setOpen}
      imageUrl={imageUrl}
      itemTitle={itemTitle}
      trigger={
        <Button className="h-auto px-6 py-3">
          <ImageIcon className="w-4 h-4" />
          View original photo
        </Button>
      }
    />
  );
}

function clampZoom(value: number): number {
  return Math.min(Math.max(value, 1), MAX_ZOOM);
}

// Zoom grows a wrapper past the edges of the viewport and lets the viewport
// scroll, so panning is native scrolling — momentum, rubber-banding and
// trackpad gestures come for free instead of being reimplemented.
//
// Split out from the dialog so its state and listeners only exist while the
// dialog is open, which also means every open starts fitted to the screen.
function PhotoViewport({
  imageUrl,
  itemTitle,
  onDismiss,
}: SourcePhotoDialogProps & { onDismiss: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // The point to keep pinned across a zoom change, in viewport coordinates.
  // Read back once the new size has landed in the DOM.
  const anchorRef = useRef<{ x: number; y: number; from: number } | null>(null);
  const pinchSpreadRef = useRef<number | null>(null);
  const pressOriginRef = useRef(new Map<number, { x: number; y: number }>());
  const isGestureRef = useRef(false);

  const zoomBy = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const bounds = viewport.getBoundingClientRect();
      setZoom((current) => {
        const next = clampZoom(current * factor);
        if (next !== current) {
          anchorRef.current = {
            x: clientX - bounds.left,
            y: clientY - bounds.top,
            from: current,
          };
        }
        return next;
      });
    },
    []
  );

  // Growing the wrapper on its own would slide the photo out from under the
  // cursor or the fingers, so the scroll offset follows the same growth factor.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!viewport || !anchor) return;

    const growth = zoom / anchor.from;
    viewport.scrollLeft = (viewport.scrollLeft + anchor.x) * growth - anchor.x;
    viewport.scrollTop = (viewport.scrollTop + anchor.y) * growth - anchor.y;
  }, [zoom]);

  // Wheel and pinch are registered by hand because both need preventDefault and
  // React attaches these two listeners passively.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(
        Math.exp(-event.deltaY / WHEEL_ZOOM_DIVISOR),
        event.clientX,
        event.clientY
      );
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;

      const [first, second] = [event.touches[0], event.touches[1]];
      const spread = Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY
      );
      const previousSpread = pinchSpreadRef.current;
      pinchSpreadRef.current = spread;
      // The opening move of a pinch only establishes the baseline distance.
      if (previousSpread === null) return;

      event.preventDefault();
      zoomBy(
        spread / previousSpread,
        (first.clientX + second.clientX) / 2,
        (first.clientY + second.clientY) / 2
      );
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchSpreadRef.current = null;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
    viewport.addEventListener("touchend", handleTouchEnd);
    viewport.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [zoomBy]);

  const handlePointerDown = (event: ReactPointerEvent) => {
    // A second finger landing means whatever follows is a gesture, not a tap.
    if (pressOriginRef.current.size > 0) isGestureRef.current = true;
    pressOriginRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handlePointerEnd = (event: ReactPointerEvent) => {
    const origin = pressOriginRef.current.get(event.pointerId);
    pressOriginRef.current.delete(event.pointerId);
    const wasGesture = isGestureRef.current;
    // Both fingers of a pinch have to lift before taps count again.
    if (pressOriginRef.current.size === 0) isGestureRef.current = false;

    if (!origin || wasGesture || event.type === "pointercancel") return;
    const travel = Math.hypot(
      event.clientX - origin.x,
      event.clientY - origin.y
    );
    if (travel > TAP_SLOP_PX) return;

    // Tapping while zoomed in almost always means "show me the whole thing
    // again", so only a tap at fit-to-screen dismisses. Esc and the close
    // button work at any zoom.
    if (zoom > 1) {
      setZoom(1);
      return;
    }
    onDismiss();
  };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      // pan-x/pan-y keeps native panning while reserving pinch for the handler
      // above, so the browser doesn't zoom the whole page underneath it.
      style={{ touchAction: "pan-x pan-y" }}
      className="h-full w-full overflow-auto overscroll-contain"
    >
      <div
        className="relative"
        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
      >
        <Image
          src={imageUrl}
          alt={`Original photo for ${itemTitle}`}
          fill
          sizes="100vw"
          // The stored photo is the image exactly as it was texted in, and the
          // point of this view is reading detail out of it — so no resizing.
          unoptimized
          className="object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
