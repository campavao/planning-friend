"use client";

import { Car, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Coordinates, getGoogleMapsUrl, getUberUrl } from "@/lib/map-links";
import { cn } from "@/lib/utils";

interface LocationCardProps {
  location: string;
  label?: string;
  /**
   * Not supplied by anything yet — no item persists coordinates. Present so the
   * more reliable coordinate dropoff can be switched on without touching the
   * card's markup. See src/lib/map-links.ts.
   */
  coordinates?: Coordinates;
  className?: string;
}

export function LocationCard({
  location,
  label = "Location",
  coordinates,
  className,
}: LocationCardProps) {
  // Both CTAs need somewhere to go, so a blank location drops the whole card
  // rather than rendering buttons that open an empty search.
  if (!location.trim()) return null;

  return (
    <Card
      className={cn(
        "border border-[var(--border)] shadow-none rounded-xl overflow-hidden",
        className
      )}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0">
          <MapPin className="w-6 h-6 text-[var(--primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="font-medium mt-1">{location}</p>
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a
            href={getGoogleMapsUrl(location, coordinates)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="w-4 h-4" />
            Directions
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a
            href={getUberUrl(location, coordinates)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Car className="w-4 h-4" />
            Uber
          </a>
        </Button>
      </div>
    </Card>
  );
}
