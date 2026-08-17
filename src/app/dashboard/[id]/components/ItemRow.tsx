"use client";

import { ChevronRight } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One fact about an item: an icon, a value, and — if there is anything to do
 * with it — a tap that opens a drawer.
 *
 * This replaces the old pattern of wrapping every fact in a Card with a 48px
 * coloured tile. Three of those filled a phone screen; a list of these reads in
 * one glance, which is what the redesign is for.
 */

interface ItemRowProps {
  icon: ElementType;
  /** Tailwind text-colour class for the icon. */
  iconClassName?: string;
  /** Small uppercase label above the value. Omit when the icon says it. */
  label?: string;
  /** The value. A string is styled; a node is rendered as-is. */
  children: ReactNode;
  /** Secondary line under the value. */
  meta?: ReactNode;
  /** Present makes the row a button with a chevron. */
  onClick?: () => void;
}

export function ItemRow({
  icon: Icon,
  iconClassName,
  label,
  children,
  meta,
  onClick,
}: ItemRowProps) {
  const interactive = typeof onClick === "function";

  const body = (
    <>
      <span className="w-6 shrink-0 flex justify-center pt-0.5">
        <Icon
          className={cn("w-5 h-5", iconClassName ?? "text-muted-foreground")}
        />
      </span>
      <span className="flex-1 min-w-0">
        {label && (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-0.5">
            {label}
          </span>
        )}
        <span className="block text-[15px] font-semibold leading-snug">
          {children}
        </span>
        {meta && (
          <span className="block text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
            {meta}
          </span>
        )}
      </span>
      {interactive && (
        <ChevronRight className="w-4 h-4 shrink-0 text-[var(--border-strong)] mt-1" />
      )}
    </>
  );

  const shared =
    "w-full flex items-start gap-3 px-2 py-3.5 rounded-xl text-left";

  if (!interactive) {
    return <div className={shared}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shared,
        "transition-colors hover:bg-[var(--card)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      )}
    >
      {body}
    </button>
  );
}

/** Rows in a stack, hairline-separated from the text column inwards so the
 *  icons read as a single gutter rather than each row being its own box. */
export function ItemRows({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 [&>*+*]:border-t [&>*+*]:border-[var(--border)]">
      {children}
    </div>
  );
}

/** A block of prose under an icon — a description, where there is nothing to
 *  tap and the value is a paragraph rather than a line. */
export function ItemProse({
  icon: Icon,
  label,
  children,
}: {
  icon: ElementType;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full flex items-start gap-3 px-2 py-3.5">
      <span className="w-6 shrink-0 flex justify-center pt-0.5">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
          {label}
        </span>
        <span className="block text-[13.5px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {children}
        </span>
      </span>
    </div>
  );
}
