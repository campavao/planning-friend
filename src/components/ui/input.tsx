import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--input)] px-4 py-2 text-base transition-all duration-200",
        "placeholder:text-[var(--muted-foreground)]",
        "focus:outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
