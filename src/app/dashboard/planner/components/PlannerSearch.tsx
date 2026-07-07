"use client";

import type { ContentCategory } from "@/lib/supabase";
import { parseDateString } from "@/lib/date-utils";
import { CalendarArrowDown, FileText, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { categoryUI } from "@/lib/categories";
import { formatUtcDateString } from "../lib/date-helpers";
import { parseSearchDate } from "../lib/parse-search-date";

interface SearchResult {
  id: string;
  planned_date: string;
  title: string;
  category: ContentCategory | null;
  thumbnail_url: string | null;
  is_note: boolean;
  owner_name?: string;
}

interface PlannerSearchProps {
  onJump: (dateKey: string) => void;
}

function formatResultDate(dateKey: string) {
  return parseDateString(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PlannerSearch({ onJump }: PlannerSearchProps) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{
    query: string;
    results: SearchResult[];
    failed?: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const dateMatch = parseSearchDate(trimmed);

  // The fetched results only apply while they match the current query;
  // otherwise a fetch is (about to be) in flight.
  const results = search?.query === trimmed ? search.results : [];
  const searching = trimmed.length >= 2 && search?.query !== trimmed;

  // Debounced item search
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/planner/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const body = res.ok ? await res.json() : null;
        setSearch({
          query: trimmed,
          results: body?.results || [],
          failed: !res.ok,
        });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Planner search failed:", err);
          setSearch({ query: trimmed, results: [], failed: true });
        }
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [trimmed]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const jump = (dateKey: string) => {
    setOpen(false);
    setQuery("");
    onJump(dateKey);
  };

  const showDropdown = open && (trimmed.length >= 2 || dateMatch);

  return (
    <div
      ref={containerRef}
      className="relative basis-full md:basis-auto md:flex-1 md:min-w-0 md:max-w-xs"
    >
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && dateMatch) jump(dateMatch);
          }}
          placeholder="Search a date, meal, or event..."
          className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {dateMatch && (
            <button
              onClick={() => jump(dateMatch)}
              className="w-full px-3 py-2.5 text-left flex items-center gap-2 hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)]"
            >
              <CalendarArrowDown className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span className="text-sm">
                Go to{" "}
                <span className="font-medium">
                  {formatResultDate(dateMatch)}
                </span>
              </span>
            </button>
          )}

          {searching && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!searching &&
            results.map((result) => {
              const Icon = result.is_note
                ? FileText
                : categoryUI(result.category || "other").icon;
              const dateKey = formatUtcDateString(
                new Date(result.planned_date),
              );
              return (
                <button
                  key={result.id}
                  onClick={() => jump(dateKey)}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[var(--muted)] transition-colors"
                >
                  {result.thumbnail_url ? (
                    <img
                      src={result.thumbnail_url}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">
                      {result.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatResultDate(dateKey)}
                      {result.owner_name && (
                        <span className="ml-1.5 bg-[var(--muted)] px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                          from {result.owner_name}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}

          {!searching && trimmed.length >= 2 && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {search?.failed
                ? "Search failed — check your connection and try again."
                : `No planned items match "${trimmed}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
