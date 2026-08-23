"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One fact about an item: an icon, a value, and — if there is anything to do
 * with it — a tap that opens a drawer or follows a link.
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
  /** Present makes the row a link that opens in a new tab. Wins over onClick. */
  href?: string;
}

export function ItemRow({
  icon: Icon,
  iconClassName,
  label,
  children,
  meta,
  onClick,
  href,
}: ItemRowProps) {
  const isLink = !!href;
  const interactive = isLink || typeof onClick === "function";
  // Leaving the app gets the external-link mark; the chevron is reserved for
  // rows that open a drawer, so the two are never confused for each other.
  const Affordance = isLink ? ExternalLink : ChevronRight;

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
        <Affordance className="w-4 h-4 shrink-0 text-[var(--border-strong)] mt-1" />
      )}
    </>
  );

  const shared =
    "w-full flex items-start gap-3 px-2 py-3.5 rounded-xl text-left";
  const pressable = cn(
    "transition-colors hover:bg-[var(--card)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
  );

  if (isLink) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(shared, pressable)}
      >
        {body}
      </a>
    );
  }

  if (!interactive) {
    return <div className={shared}>{body}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={cn(shared, pressable)}>
      {body}
    </button>
  );
}

/** Rows in a stack, hairline-separated from the text column inwards so the
 *  icons read as a single gutter rather than each row being its own box.
 *
 *  The hairline is a pseudo-element rather than a border-top: the rows are
 *  rounded for their hover state, and a border follows that radius, so every
 *  divider curled down into a hook at both ends. */
export function ItemRows({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "px-2",
        "[&>*+*]:relative",
        "[&>*+*]:before:content-[''] [&>*+*]:before:absolute",
        "[&>*+*]:before:inset-x-0 [&>*+*]:before:top-0 [&>*+*]:before:h-px",
        "[&>*+*]:before:bg-[var(--border)]"
      )}
    >
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
