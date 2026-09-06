"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Content,
  GiftAssignment,
  GiftIdeaData,
  GiftRecipientWithAssignments,
} from "@/lib/supabase";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Gift,
  Pencil,
  PenLine,
  Plus,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-config";
import { useSession } from "../useSession";
import { ListSkeleton } from "@/components/Skeletons";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

export default function GiftPlannerPage() {
  const [newRecipientName, setNewRecipientName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGiven, setShowGiven] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const keyboardInset = useKeyboardInset();

  // Session handling (redirect to login if unauthenticated) is consistent
  // with the rest of the dashboard.
  const { isLoading: sessionLoading } = useSession();

  const {
    data: recipientsData,
    isLoading: recipientsLoading,
    mutate: mutateRecipients,
  } = useSWR<{ recipients: GiftRecipientWithAssignments[] }>(
    "/api/gifts/recipients?include=assignments",
    fetcher
  );
  const { data: giftsData, mutate: mutateGifts } = useSWR<{
    giftIdeas: Content[];
  }>("/api/gifts/assignments", fetcher);

  const recipients = recipientsData?.recipients ?? [];
  const giftIdeas = giftsData?.giftIdeas ?? [];

  // Refresh both lists after a mutation (the SWR equivalent of the old
  // fetchData() re-fetch).
  const refresh = useCallback(() => {
    mutateRecipients();
    mutateGifts();
  }, [mutateRecipients, mutateGifts]);

  const loading = sessionLoading || (recipientsLoading && !recipientsData);

  const addRecipient = async () => {
    if (!newRecipientName.trim()) return;

    try {
      const res = await fetch("/api/gifts/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRecipientName.trim() }),
      });

      if (res.ok) {
        setNewRecipientName("");
        refresh();
      }
    } catch (error) {
      console.error("Failed to add recipient:", error);
    }
  };

  const updateRecipient = async (id: string) => {
    if (!editName.trim()) return;

    try {
      const res = await fetch("/api/gifts/recipients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim() }),
      });

      if (res.ok) {
        setEditingId(null);
        setEditName("");
        refresh();
      }
    } catch (error) {
      console.error("Failed to update recipient:", error);
    }
  };

  const deleteRecipient = async (id: string) => {
    if (!confirm("Delete this person? All gift assignments will be removed."))
      return;

    try {
      const res = await fetch(`/api/gifts/recipients?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        refresh();
      }
    } catch (error) {
      console.error("Failed to delete recipient:", error);
    }
  };

  const closeAssignDrawer = () => {
    setAssigningTo(null);
    setSearchQuery("");
  };

  const assignGift = async (recipientId: string, contentId: string) => {
    try {
      const res = await fetch("/api/gifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, contentId }),
      });

      if (res.ok) {
        closeAssignDrawer();
        refresh();
      }
    } catch (error) {
      console.error("Failed to assign gift:", error);
    }
  };

  /** What was typed becomes the gift, no saved item needed. */
  const addGiftNote = async (recipientId: string) => {
    const noteTitle = searchQuery.trim();
    if (!noteTitle) return;

    setAddingNote(true);
    try {
      const res = await fetch("/api/gifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, noteTitle }),
      });

      if (res.ok) {
        closeAssignDrawer();
        refresh();
      }
    } catch (error) {
      console.error("Failed to add gift note:", error);
    } finally {
      setAddingNote(false);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/gifts/assignments?id=${assignmentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        refresh();
      }
    } catch (error) {
      console.error("Failed to remove assignment:", error);
    }
  };

  const toggleGiftGiven = async (assignmentId: string, currentlyGiven: boolean) => {
    try {
      const res = await fetch("/api/gifts/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assignmentId, given: !currentlyGiven }),
      });

      if (res.ok) {
        refresh();
      }
    } catch (error) {
      console.error("Failed to toggle gift given status:", error);
    }
  };

  const getFilteredGifts = (recipientId: string) => {
    const recipient = recipients.find((r) => r.id === recipientId);
    const assignedIds = new Set(
      recipient?.assignments.flatMap((a) =>
        a.content_id ? [a.content_id] : []
      ) ?? []
    );

    return giftIdeas.filter((g) => {
      if (assignedIds.has(g.id)) return false;
      if (searchQuery) {
        return g.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  };

  const GiftsHeader = (
    <div className="bg-[var(--accent)] px-4 py-5 sticky top-0 z-20">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        <Link href="/dashboard" className="hidden md:inline-flex">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="heading-1 text-white">Gift Ideas</h1>
      </div>
    </div>
  );

  if (loading) {
    return (
      <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
        {GiftsHeader}
        <div className="max-w-4xl mx-auto px-3 md:px-4 py-6">
          <ListSkeleton count={4} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
      {GiftsHeader}

      <div className="max-w-4xl mx-auto px-3 md:px-4 py-6">
        {/* Add New Person */}
        <Card className="mb-6">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-[var(--accent)]" />
              </div>
              Add a Person
            </h2>
          </div>
          <div className="p-4 flex gap-2">
            <Input
              placeholder="Enter name (e.g., Mom, Dad, Best Friend)"
              value={newRecipientName}
              onChange={(e) => setNewRecipientName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRecipient()}
              className="flex-1"
            />
            <Button onClick={addRecipient} variant="secondary">
              <Gift className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </Card>

        {/* Recipients List */}
        {recipients.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Gift className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              No people added yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Add people you want to give gifts to, then assign gift ideas to
              them.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Show/hide given gifts toggle */}
            {recipients.some((r) =>
              r.assignments.some((a: GiftAssignment) => a.given_at)
            ) && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowGiven(!showGiven)}
                  className="h-auto p-0 gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  {showGiven ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {showGiven ? "Hide" : "Show"} given gifts
                </Button>
              </div>
            )}
            {recipients.map((recipient) => (
              <Card key={recipient.id} className="overflow-hidden">
                <CardHeader className="pb-3 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    {editingId === recipient.id ? (
                      <div className="flex gap-2 flex-1 mr-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && updateRecipient(recipient.id)
                          }
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => updateRecipient(recipient.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-[var(--border)]"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                          {recipient.name}
                          <Badge className="ml-2 bg-[var(--accent)]/10 text-[var(--accent)]">
                            {recipient.assignments.length} gift
                            {recipient.assignments.length !== 1 ? "s" : ""}
                          </Badge>
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(recipient.id);
                              setEditName(recipient.name);
                            }}
                            className="rounded-lg hover:bg-[var(--muted)]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg text-destructive hover:bg-red-50"
                            onClick={() => deleteRecipient(recipient.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 bg-white rounded-b-2xl">
                  {/* Assigned Gifts */}
                  {recipient.assignments.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {recipient.assignments
                        .filter((a: GiftAssignment) => showGiven || !a.given_at)
                        .map((assignment: GiftAssignment) => {
                          const giftData = assignment.content
                            ?.data as GiftIdeaData | undefined;
                          const isGiven = !!assignment.given_at;
                          const isNote = !assignment.content;
                          return (
                            <div
                              key={assignment.id}
                              className={`group flex items-center gap-3 rounded-xl p-3 ${
                                isGiven
                                  ? "bg-[var(--muted)]/50 opacity-60"
                                  : "bg-[var(--muted)]"
                              }`}
                            >
                              {isNote ? (
                                <div className="w-12 h-12 shrink-0 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                                  <PenLine className="w-5 h-5 text-[var(--accent)]" />
                                </div>
                              ) : (
                                assignment.content?.thumbnail_url && (
                                  <img
                                    src={assignment.content.thumbnail_url}
                                    alt=""
                                    className={`w-12 h-12 object-cover shrink-0 rounded-lg ${
                                      isGiven ? "grayscale" : ""
                                    }`}
                                  />
                                )
                              )}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`font-medium text-sm line-clamp-1 ${
                                    isGiven ? "line-through text-muted-foreground" : ""
                                  }`}
                                >
                                  {assignment.content?.title ??
                                    assignment.note_title}
                                </p>
                                {giftData?.cost && (
                                  <p
                                    className={`text-sm font-semibold ${
                                      isGiven
                                        ? "text-muted-foreground line-through"
                                        : "text-[var(--accent)]"
                                    }`}
                                  >
                                    {giftData.cost}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0 items-center">
                                {giftData?.amazon_link && !isGiven && (
                                  <a
                                    href={giftData.amazon_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                                  >
                                    <ShoppingCart className="w-3 h-3" />
                                    Amazon
                                  </a>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    toggleGiftGiven(assignment.id, isGiven)
                                  }
                                  className={
                                    isGiven
                                      ? "text-[var(--secondary)] bg-[var(--secondary)]/10 hover:text-[var(--secondary)] hover:bg-[var(--secondary)]/10"
                                      : "text-muted-foreground hover:text-[var(--secondary)] hover:bg-[var(--secondary)]/10"
                                  }
                                  title={isGiven ? "Mark as not given" : "Mark as given"}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    removeAssignment(assignment.id)
                                  }
                                  className="text-destructive hover:text-destructive hover:bg-red-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      {/* Show count of hidden given gifts */}
                      {!showGiven &&
                        recipient.assignments.filter(
                          (a: GiftAssignment) => a.given_at
                        ).length > 0 && (
                          <Button
                            variant="ghost"
                            onClick={() => setShowGiven(true)}
                            className="h-auto w-full py-1 px-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
                          >
                            {
                              recipient.assignments.filter(
                                (a: GiftAssignment) => a.given_at
                              ).length
                            }{" "}
                            given gift
                            {recipient.assignments.filter(
                              (a: GiftAssignment) => a.given_at
                            ).length !== 1
                              ? "s"
                              : ""}{" "}
                            hidden
                          </Button>
                        )}
                    </div>
                  )}

                  {/* Add Gift Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-2 border-dashed border-[var(--border)] rounded-xl hover:bg-[var(--muted)]"
                    onClick={() => setAssigningTo(recipient.id)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Gift Idea
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State for Gift Ideas */}
        {giftIdeas.length === 0 && recipients.length > 0 && (
          <Card className="p-6 mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              No gift ideas saved yet. Text a TikTok or Instagram with product
              recommendations to save gift ideas!
            </p>
          </Card>
        )}
      </div>

      {/* Assign Gift Modal */}
      {assigningTo !== null && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) closeAssignDrawer();
          }}
        >
          <DialogContent
            showCloseButton={false}
            // Rest on top of the keyboard rather than under it, and shrink so
            // the header (and its close button) stays on screen while typing.
            style={
              keyboardInset
                ? {
                    bottom: keyboardInset,
                    maxHeight: `calc(100vh - ${keyboardInset}px - 1rem)`,
                  }
                : undefined
            }
            className="top-auto bottom-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:bottom-auto md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] w-full max-w-full sm:max-w-full md:max-w-lg rounded-t-2xl rounded-b-none md:rounded-b-2xl p-0 gap-0 max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dark)] md:rounded-t-2xl">
              <DialogTitle className="font-semibold text-base leading-normal text-white">
                Add Gift for{" "}
                {recipients.find((r) => r.id === assigningTo)?.name}
              </DialogTitle>
              <DialogClose
                aria-label="Close"
                className="text-white/80 hover:text-white p-2 -m-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </DialogClose>
            </div>

            {/* One field: filters saved ideas, or becomes a quick note */}
            <form
              className="p-4 border-b border-[var(--border)] bg-white"
              onSubmit={(e) => {
                e.preventDefault();
                addGiftNote(assigningTo);
              }}
            >
              <Input
                type="text"
                placeholder="Search saved ideas, or type a gift..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                enterKeyHint="done"
              />
            </form>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
              {/* The typed text as a note first, then saved ideas */}
              {searchQuery.trim() && (
                <button
                  onClick={() => addGiftNote(assigningTo)}
                  disabled={addingNote}
                  className="w-full bg-white border border-[var(--accent)]/40 rounded-xl p-3 text-left flex items-center gap-3 hover:border-[var(--accent)] hover:shadow-sm transition-all disabled:opacity-60"
                >
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                    <PenLine className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium line-clamp-1">
                      Add &ldquo;{searchQuery.trim()}&rdquo;
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {addingNote
                        ? "Saving..."
                        : "Quick note — no saved item needed"}
                    </p>
                  </div>
                </button>
              )}

              {getFilteredGifts(assigningTo).map((gift) => {
                const giftData = gift.data as GiftIdeaData;
                return (
                  <button
                    key={gift.id}
                    onClick={() => assignGift(assigningTo, gift.id)}
                    className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-left flex items-center gap-3 hover:border-[var(--accent)]/30 hover:shadow-sm transition-all"
                  >
                    {gift.thumbnail_url && (
                      <img
                        src={gift.thumbnail_url}
                        alt=""
                        className="w-14 h-14 object-cover shrink-0 rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{gift.title}</p>
                      {giftData?.cost && (
                        <p className="text-sm text-[var(--accent)] font-semibold">
                          {giftData.cost}
                        </p>
                      )}
                      {giftData?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {giftData.description}
                        </p>
                      )}
                    </div>
                    {giftData?.amazon_link && (
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}

              {getFilteredGifts(assigningTo).length === 0 &&
                !searchQuery.trim() && (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--muted)] flex items-center justify-center">
                      <Gift className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-sm">No saved gift ideas</p>
                    <p className="text-xs mt-2">
                      Type a gift above to add it as a note
                      {giftIdeas.length === 0 &&
                        ", or text product TikToks or Reels to save ideas"}
                      .
                    </p>
                  </div>
                )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
