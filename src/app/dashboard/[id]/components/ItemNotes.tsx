"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ItemNoteWithOccasion } from "@/lib/supabase";
import { NOTE_BODY_MAX_LENGTH } from "@/lib/schemas/item-notes";
import { fetcher } from "@/lib/swr-config";
import { CalendarClock, NotebookPen, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

const RATINGS = [1, 2, 3, 4, 5];

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RatingStars({
  value,
  onChange,
}: {
  value: number | null;
  onChange?: (next: number | null) => void;
}) {
  const readOnly = !onChange;

  return (
    <div className="flex items-center gap-0.5">
      {RATINGS.map((score) => {
        const filled = value !== null && score <= value;
        const star = (
          <Star
            className={`w-4 h-4 ${
              filled
                ? "fill-[var(--accent)] text-[var(--accent)]"
                : "text-muted-foreground"
            }`}
          />
        );

        if (readOnly) {
          return <span key={score}>{star}</span>;
        }

        return (
          <button
            key={score}
            type="button"
            // Tapping the current score clears it — rating is optional, so
            // there has to be a way back to "no opinion".
            onClick={() => onChange(value === score ? null : score)}
            aria-label={`${score} star${score === 1 ? "" : "s"}`}
            aria-pressed={filled}
            className="p-1 -m-0.5 cursor-pointer"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

interface ItemNotesProps {
  contentId: string;
  /** Opens the composer on mount — the note-reminder push deep-links here. */
  autoOpenComposer?: boolean;
}

/**
 * Notes on the item itself: how it actually went, newest first. Deliberately
 * many per item rather than one editable review — the point is comparing
 * repeat visits, and each note is stamped with the occasion it came from when
 * it was written from a scheduled plan item.
 */
export function ItemNotes({ contentId, autoOpenComposer }: ItemNotesProps) {
  const { data, isLoading, mutate } = useSWR<{
    notes: ItemNoteWithOccasion[];
  }>(`/api/content/${contentId}/notes`, fetcher, {
    revalidateOnFocus: false,
  });

  const [composing, setComposing] = useState(Boolean(autoOpenComposer));
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (composing) composerRef.current?.focus();
  }, [composing]);

  const notes = data?.notes ?? [];

  const resetComposer = () => {
    setBody("");
    setRating(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!body.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${contentId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), rating }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save note");
      }
      resetComposer();
      setComposing(false);
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;

    // Drop it from the cached list first so the tap feels immediate; a failed
    // delete revalidates and the note comes back.
    mutate(
      (current) =>
        current && { notes: current.notes.filter((n) => n.id !== noteId) },
      { revalidate: false }
    );

    const res = await fetch(
      `/api/content/${contentId}/notes?noteId=${noteId}`,
      { method: "DELETE" }
    );
    if (!res.ok) mutate();
  };

  return (
    <div className="pt-6 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="heading-3 flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-[var(--primary)]" />
          Notes
        </h3>
        {!composing && (
          <Button variant="outline" size="sm" onClick={() => setComposing(true)}>
            Add note
          </Button>
        )}
      </div>

      {composing && (
        <Card className="p-4 mb-4 shadow-none border border-[var(--border)]">
          <Textarea
            ref={composerRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={NOTE_BODY_MAX_LENGTH}
            placeholder="How was it? What would you change next time?"
            className="min-h-24"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Rating
              </span>
              <RatingStars value={rating} onChange={setRating} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetComposer();
                  setComposing(false);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !body.trim()}>
                {saving ? "Saving..." : "Save note"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </Card>
      )}

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      ) : notes.length === 0 ? (
        !composing && (
          <p className="text-sm text-muted-foreground">
            No notes yet. After you try this, jot down how it went.
          </p>
        )
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Card className="p-4 shadow-none border border-[var(--border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-muted-foreground">
                      {formatNoteDate(note.created_at)}
                    </span>
                    {note.occasion?.planned_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {note.occasion.note_title ||
                          formatNoteDate(note.occasion.planned_date)}
                      </span>
                    )}
                    {typeof note.rating === "number" && (
                      <RatingStars value={note.rating} />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(note.id)}
                    aria-label="Delete note"
                    className="text-destructive hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
