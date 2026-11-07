"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  top,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  top?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const keyboardInset = useKeyboardInset();

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
          style={
            keyboardInset
              ? {
                  bottom: keyboardInset,
                  maxHeight: `calc(100dvh - ${keyboardInset}px - 1rem)`,
                }
              : undefined
          }
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col",
            "rounded-t-3xl bg-[var(--card)] shadow-[var(--shadow-xl)] focus:outline-none",
            "md:bottom-4 md:rounded-b-3xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "duration-200"
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-[var(--border-strong)]"
          />
          <div className="flex shrink-0 items-start gap-3 px-5 pt-1 pb-3">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="heading-2 leading-tight">
                {title}
              </DialogPrimitive.Title>
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
            <DialogPrimitive.Close
              aria-label="Close"
              className="surface-raised -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {top && <div className="shrink-0 space-y-3 px-4 pb-3">{top}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--border)]">
            {children}
          </div>
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
