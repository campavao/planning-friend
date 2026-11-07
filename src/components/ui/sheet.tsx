"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet for putting something somewhere — on a day, on someone's gift
 * list. White, with a handle, a serif title and a raised close button, like the
 * rest of the app now; the orange gradient banners these replaced read as a
 * different product.
 *
 * Three bands: `top` holds the controls that should never scroll away (the
 * week strip, the search field), `children` scrolls, and `footer` holds the
 * one action that finishes the job. The whole sheet rests on the on-screen
 * keyboard rather than sliding under it.
 *
 * `header` replaces the visible title row for a sheet whose first control
 * already says what it's for — the planner's week strip shows the day better
 * than "Add to Sun, Nov 8" did, and the line it saves goes to the list. The
 * title is still there for screen readers.
 *
 * It closes the way a sheet does on a phone: drag it down by the handle or the
 * header, tap outside it, or press Escape. There's no visible close button —
 * the close control is still there for screen readers.
 */

/** How far a drag has to travel, or how fast (px/ms), to close the sheet. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.6;

/** Starts once the finger has clearly moved down, so a tap is still a tap. */
const DRAG_SLOP = 6;

function useDragToClose(onClose: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number; id: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { y: e.clientY, t: Date.now(), id: e.pointerId };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dy = e.clientY - start.current.y;
    if (!moved.current) {
      if (dy < DRAG_SLOP) return;
      moved.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setOffset(Math.max(0, dy));
  };

  const end = (e: React.PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dy = e.clientY - start.current.y;
    const velocity = dy / Math.max(1, Date.now() - start.current.t);
    start.current = null;
    setDragging(false);
    if (moved.current && (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY)) {
      onClose();
      // The exit animation continues from where the finger left it.
      return;
    }
    setOffset(0);
  };

  return {
    offset,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      // A drag that started on a day or a chip mustn't also tap it.
      onClickCapture: (e: React.MouseEvent) => {
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      },
    },
  };
}
export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  header,
  top,
  footer,
  fullHeight = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shown beside the close button in place of the title. */
  header?: React.ReactNode;
  top?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * A fixed height instead of fitting the content. For a sheet whose list
   * changes as you type or switch tabs: fitting made it grow and shrink under
   * your thumb with every keystroke.
   */
  fullHeight?: boolean;
  children?: React.ReactNode;
}) {
  const keyboardInset = useKeyboardInset();
  const drag = useDragToClose(() => onOpenChange(false));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          // Opening shouldn't throw the keyboard up over the day strip and
          // suggestions; the field is one tap away when it's what you want.
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            ...(keyboardInset
              ? {
                  bottom: keyboardInset,
                  [fullHeight ? "height" : "maxHeight"]:
                    `min(${fullHeight ? "90dvh" : "88dvh"}, calc(100dvh - ${keyboardInset}px - 1rem))`,
                }
              : null),
            ...(drag.offset
              ? { transform: `translateY(${drag.offset}px)` }
              : null),
            transition: drag.dragging ? "none" : undefined,
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col",
            fullHeight ? "h-[90dvh]" : "max-h-[88dvh]",
            "rounded-t-3xl bg-[var(--card)] shadow-[var(--shadow-xl)] focus:outline-none",
            "md:bottom-4 md:rounded-b-3xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "transition-transform duration-200"
          )}
        >
          {/* The handle and the header are the drag zone. touch-none keeps the
              browser from claiming the gesture as a scroll. */}
          <div {...drag.handlers} className="shrink-0 touch-none select-none">
            <div aria-hidden className="flex justify-center pt-2 pb-1.5">
              <div className="h-1 w-9 rounded-full bg-[var(--border-strong)]" />
            </div>
            <div
              className={cn(
                "flex items-start gap-3 pt-0.5",
                header ? "px-4 pb-2" : "px-5 pb-3"
              )}
            >
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title
                  className={header ? "sr-only" : "heading-2 leading-tight"}
                >
                  {title}
                </DialogPrimitive.Title>
                {header}
                {subtitle ? (
                  <DialogPrimitive.Description className="mt-0.5 truncate text-sm text-muted-foreground">
                    {subtitle}
                  </DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">
                    {title}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close className="sr-only">Close</DialogPrimitive.Close>
            </div>
          </div>
          {top && <div className="shrink-0 space-y-3 px-4 pb-3">{top}</div>}
          {children && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--border)]">
              {children}
            </div>
          )}
          {footer && (
            <div className="shrink-0 border-t border-[var(--border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** A small label over a group of rows inside a sheet. */
export function SheetSection({
  label,
  action,
  children,
  className,
}: {
  label: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pt-3", className)}>
      <div className="flex items-baseline justify-between px-4 pb-1.5">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          {label}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
