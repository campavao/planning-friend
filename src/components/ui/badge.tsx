import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)]",
        secondary:
          "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
        destructive:
          "bg-[var(--destructive)] text-white",
        outline:
          "border border-[var(--border)] text-[var(--foreground)]",
        meal:
          "bg-[var(--meal-bg)] text-[var(--meal)]",
        drink:
          "bg-[var(--drink-bg)] text-[var(--drink)]",
        event:
          "bg-[var(--event-bg)] text-[var(--event)]",
        date:
          "bg-[var(--date-bg)] text-[var(--date)]",
        gift:
          "bg-[var(--gift-bg)] text-[var(--gift)]",
        travel:
          "bg-[var(--travel-bg)] text-[var(--travel)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
