import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A grouped list: a small label above, rows inside one white card divided by
 * hairlines, and an optional note below — the iOS settings shape. One card per
 * group instead of one per row keeps a long list from reading as a stack of
 * unrelated tiles.
 */
export function ListGroup({
  label,
  action,
  footer,
  children,
  className,
}: {
  label?: React.ReactNode;
  /** Right of the label — "Show given". */
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(label || action) && (
        <div className="flex items-baseline justify-between px-4 pb-1.5">
          {label && (
            <h2 className="text-[13px] font-medium text-muted-foreground">
              {label}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[var(--shadow-card)] divide-y divide-[var(--border)]">
        {children}
      </div>
      {footer && (
        <p className="px-4 pt-1.5 text-xs text-muted-foreground">{footer}</p>
      )}
    </section>
  );
}

const ROW_CLASS = "flex w-full items-center gap-3 px-4 py-3 min-h-[52px] text-left";

/**
 * One row of a ListGroup. With `href` or `onClick` it is the tap target and
 * gets a chevron; otherwise `children` sit at its right — a switch, a value.
 */
export function ListRow({
  icon,
  label,
  description,
  children,
  href,
  onClick,
  destructive,
  className,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[15px] font-medium",
            destructive && "text-destructive"
          )}
        >
          {label}
        </div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {description}
          </div>
        )}
      </div>
      {children}
      {(href || onClick) && !destructive && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
    </>
  );

  const interactive = cn(
    ROW_CLASS,
    "transition-colors hover:bg-[var(--background)] focus-visible:outline-none focus-visible:bg-[var(--background)]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={interactive}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={interactive}>
        {body}
      </button>
    );
  }
  return <div className={cn(ROW_CLASS, className)}>{body}</div>;
}
