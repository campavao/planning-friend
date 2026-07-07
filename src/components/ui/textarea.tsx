import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--input)] px-4 py-2 text-base transition-all duration-200",
        "placeholder:text-[var(--muted-foreground)]",
        "focus:outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
