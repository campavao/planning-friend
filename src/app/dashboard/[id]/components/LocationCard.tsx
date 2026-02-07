"use client";

import { MapPin } from "lucide-react";

function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

interface LocationCardProps {
  location: string;
  label?: string;
  className?: string;
}

export function LocationCard({
  location,
  label = "Location",
  className,
}: LocationCardProps) {
  return (
    <a
      href={getGoogleMapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-start gap-4 p-4 card-flat rounded-xl hover:bg-[var(--muted)] transition-colors ${className ?? ""}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0">
        <MapPin className="w-6 h-6 text-[var(--primary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="font-medium mt-1">{location}</p>
      </div>
    </a>
  );
}
