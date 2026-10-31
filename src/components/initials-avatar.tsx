import { cn } from "@/lib/utils";

// The category palette, so a person's colour belongs to the same family as
// everything else on screen instead of introducing a new one.
const TONES = [
  "bg-[var(--gift-bg)] text-[var(--gift)]",
  "bg-[var(--event-bg)] text-[var(--event)]",
  "bg-[var(--meal-bg)] text-[var(--secondary-dark)]",
  "bg-[var(--date-bg)] text-[var(--date)]",
  "bg-[var(--drink-bg)] text-[var(--drink)]",
  "bg-[var(--travel-bg)] text-[#2FA39B]",
];

/** "Andra Patel" → "AP", "mom" → "M". */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** Stable per name, so someone keeps their colour across visits. */
export function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

export function InitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        toneFor(name),
        className
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
