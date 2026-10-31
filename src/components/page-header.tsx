import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The top of a tab page: a large serif title on the page's own background,
 * the way the home greeting and the planner sit, rather than a slab of brand
 * colour per tab. The count rides beside the title ("Friends 5") so it costs no
 * line of its own, and the page's one primary action sits at the right.
 */
export function PageHeader({
  title,
  count,
  subtitle,
  backHref,
  backOnMobile = false,
  action,
  wide = false,
  className,
}: {
  title: string;
  count?: number;
  subtitle?: React.ReactNode;
  /** Where the back arrow goes. Tab pages only need it on desktop, where
   *  there is no bottom nav. */
  backHref?: string;
  backOnMobile?: boolean;
  action?: React.ReactNode;
  /** Match a page whose content runs the full 7xl width, like a grid. */
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("sticky top-0 z-20 bg-[var(--background)]", className)}>
      <div
        className={cn(
          "mx-auto px-4 md:px-6 pt-3 pb-3 flex items-center gap-2",
          wide ? "max-w-7xl" : "max-w-4xl"
        )}
      >
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back to home"
            className={cn(
              "-ml-2 size-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--muted)]",
              backOnMobile ? "inline-flex" : "hidden md:inline-flex"
            )}
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="heading-1 flex items-baseline gap-2">
            <span className="truncate">{title}</span>
            {count !== undefined && (
              <span className="font-sans text-base font-medium text-muted-foreground">
                {count}
              </span>
            )}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

/** The round raised button a header's action uses — "+", "⋯". */
export const HEADER_ACTION_CLASS =
  "surface-raised inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
