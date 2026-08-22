"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * A bottom drawer — the standard home for secondary actions across the app.
 *
 * Built on Radix Dialog rather than a bare div so focus trapping, Escape, the
 * scroll lock and the aria wiring are handled. Only the presentation differs:
 * it rises from the bottom edge and is thumb-reachable, which is the whole
 * reason it beats a menu anchored to a header button on a phone.
 *
 * A title is required. Radix warns without one, and more usefully, a drawer of
 * unlabelled verbs is ambiguous the moment there is more than one on a screen —
 * "Edit" means something different under "Location" than under the item itself.
 */

interface ActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shown under the title when the actions need context. */
  description?: string;
  children: React.ReactNode;
}

export function ActionDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: ActionDrawerProps) {
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
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 bg-[var(--card)]",
            "rounded-t-3xl shadow-[var(--shadow-xl)]",
            "px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
            "max-h-[85vh] overflow-y-auto",
            "mx-auto max-w-lg sm:rounded-b-3xl sm:bottom-4",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "duration-200"
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-1.5 mb-2 h-1 w-9 rounded-full bg-[var(--border-strong)]"
          />
          <DialogPrimitive.Title className="px-3.5 pb-2 text-sm font-semibold text-muted-foreground">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="px-3.5 pb-2 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          ) : (
            // Radix logs a warning when Content has no Description; this says
            // "deliberately none" instead of rendering an empty paragraph.
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface DrawerItemProps extends React.ComponentProps<"button"> {
  icon?: React.ElementType;
  /** Right-aligned muted text — a count, a current value. */
  hint?: string;
  destructive?: boolean;
}

/** One row of a drawer. Renders as a button; use `asChild`-style composition by
 *  passing an anchor through `render` if a row ever needs to be a real link. */
export function DrawerItem({
  icon: Icon,
  hint,
  destructive,
  className,
  children,
  ...props
}: DrawerItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-3.5 px-3.5 py-3.5 rounded-2xl",
        "text-[15px] font-medium text-left transition-colors",
        "hover:bg-[var(--background)] focus-visible:bg-[var(--background)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        destructive && "text-destructive",
        className
      )}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn(
            "w-[19px] h-[19px] shrink-0",
            destructive ? "text-destructive" : "text-muted-foreground"
          )}
        />
      )}
      <span className="flex-1 min-w-0">{children}</span>
      {hint && (
        <span className="text-xs text-muted-foreground shrink-0">{hint}</span>
      )}
    </button>
  );
}

/** An anchor styled as a drawer row, for actions that are really navigations
 *  (Maps, Uber, a booking link) — so they get middle-click and long-press. */
export function DrawerLink({
  icon: Icon,
  hint,
  className,
  children,
  ...props
}: React.ComponentProps<"a"> & { icon?: React.ElementType; hint?: string }) {
  return (
    <a
      className={cn(
        "w-full flex items-center gap-3.5 px-3.5 py-3.5 rounded-2xl",
        "text-[15px] font-medium text-left transition-colors",
        "hover:bg-[var(--background)] focus-visible:bg-[var(--background)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-[19px] h-[19px] shrink-0 text-muted-foreground" />}
      <span className="flex-1 min-w-0">{children}</span>
      {hint && (
        <span className="text-xs text-muted-foreground shrink-0">{hint}</span>
      )}
    </a>
  );
}

export function DrawerSeparator() {
  return <div className="h-px bg-[var(--border)] mx-3.5 my-1.5" />;
}
