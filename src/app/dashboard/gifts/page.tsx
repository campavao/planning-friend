"use client";

import { InitialsAvatar } from "@/components/initials-avatar";
import { HEADER_ACTION_CLASS, PageHeader } from "@/components/page-header";
import {
  ActionDrawer,
  DrawerItem,
  DrawerSeparator,
} from "@/components/ui/action-drawer";
import { Button } from "@/components/ui/button";
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
  Check,
  Eye,
  EyeOff,
  Gift,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { displayPrice } from "@/lib/price";
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
  const [addingPerson, setAddingPerson] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
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
        setAddingPerson(false);
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

  const anyGiven = recipients.some((r) =>
    r.assignments.some((a: GiftAssignment) => a.given_at)
  );

  const header = (
    <PageHeader
      title="Gifts"
      count={loading ? undefined : recipients.length}
      backHref="/dashboard"
      action={
        <button
          type="button"
          onClick={() => setAddingPerson(true)}
          aria-label="Add a person"
          className={HEADER_ACTION_CLASS}
        >
          <UserPlus className="size-5" />
        </button>
      }
    />
  );

  if (loading) {
    return (
      <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
        {header}
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
          <ListSkeleton count={4} />
        </div>
      </main>
    );
  }

  const addPersonForm = (
    <form
      className="flex gap-2 rounded-2xl bg-[var(--card)] p-3 shadow-[var(--shadow-card)]"
      onSubmit={(e) => {
        e.preventDefault();
        addRecipient();
      }}
    >
      <Input
        placeholder="Name (Mom, Dad, Best Friend…)"
        aria-label="Name"
        value={newRecipientName}
        onChange={(e) => setNewRecipientName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setAddingPerson(false)}
        className="h-10 flex-1"
        autoFocus
      />
      <Button type="submit" disabled={!newRecipientName.trim()}>
        Add
      </Button>
    </form>
  );

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
      {header}

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-1 pb-6 space-y-4">
        {recipients.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--gift-bg)] flex items-center justify-center">
              <Gift className="w-8 h-8 text-[var(--gift)]" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No one to shop for yet</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Add the people you buy for, then keep their gift ideas together.
            </p>
            <div className="max-w-sm mx-auto text-left">{addPersonForm}</div>
          </div>
        ) : (
          <>
            {anyGiven && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGiven(!showGiven)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {showGiven ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  {showGiven ? "Hide" : "Show"} given
                </button>
              </div>
            )}

            {addingPerson && addPersonForm}

            {recipients.map((recipient) => {
              const given = recipient.assignments.filter(
                (a: GiftAssignment) => a.given_at
              ).length;
              const total = recipient.assignments.length;
              const visible = recipient.assignments.filter(
                (a: GiftAssignment) => showGiven || !a.given_at
              );
              const hiddenGiven = showGiven ? 0 : given;

              return (
                <section
                  key={recipient.id}
                  className="overflow-hidden rounded-2xl bg-[var(--card)] shadow-[var(--shadow-card)]"
                >
                  {/* The person, the way a registry opens with whose it is:
                      their name large, and how far along the list is. */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <InitialsAvatar name={recipient.name} className="size-11 text-base" />
                    {editingId === recipient.id ? (
                      <form
                        className="flex flex-1 gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateRecipient(recipient.id);
                        }}
                      >
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Escape" && setEditingId(null)
                          }
                          aria-label="Name"
                          className="h-9 flex-1"
                          autoFocus
                        />
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-lg font-semibold leading-tight truncate">
                            {recipient.name}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            {total === 0
                              ? "No ideas yet"
                              : `${total} ${total === 1 ? "idea" : "ideas"}${
                                  given > 0 ? ` · ${given} given` : ""
                                }`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMenuFor(recipient.id)}
                          aria-label={`Options for ${recipient.name}`}
                          className="surface-raised inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {visible.map((assignment: GiftAssignment) => {
                      const giftData = assignment.content?.data as
                        | GiftIdeaData
                        | undefined;
                      const isGiven = !!assignment.given_at;
                      const isNote = !assignment.content;
                      const title =
                        assignment.content?.title ?? assignment.note_title;
                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          {/* Given is a checkbox — the list is a shopping
                              list, and that's how you tick one off. */}
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isGiven}
                            aria-label={`${title}: given`}
                            onClick={() =>
                              toggleGiftGiven(assignment.id, isGiven)
                            }
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                              isGiven
                                ? "bg-[var(--secondary-dark)] text-white"
                                : "surface-inset text-transparent hover:text-muted-foreground"
                            }`}
                          >
                            <Check className="size-3.5" strokeWidth={3} />
                          </button>
                          {isNote ? (
                            <div className="size-12 shrink-0 rounded-xl bg-[var(--gift-bg)] flex items-center justify-center">
                              <PenLine className="size-5 text-[var(--gift)]" />
                            </div>
                          ) : assignment.content?.thumbnail_url ? (
                            <img
                              src={assignment.content.thumbnail_url}
                              alt=""
                              className={`size-12 shrink-0 rounded-xl object-cover ${
                                isGiven ? "grayscale opacity-60" : ""
                              }`}
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            {assignment.content ? (
                              <Link
                                href={`/dashboard/${assignment.content.id}`}
                                className={`text-sm font-medium leading-snug line-clamp-2 hover:underline ${
                                  isGiven
                                    ? "line-through text-muted-foreground"
                                    : ""
                                }`}
                              >
                                {title}
                              </Link>
                            ) : (
                              <p
                                className={`text-sm font-medium leading-snug line-clamp-2 ${
                                  isGiven
                                    ? "line-through text-muted-foreground"
                                    : ""
                                }`}
                              >
                                {title}
                              </p>
                            )}
                            {displayPrice(giftData?.cost) && (
                              <span className="surface-inset mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold">
                                {displayPrice(giftData?.cost)}
                              </span>
                            )}
                          </div>
                          {giftData?.amazon_link && !isGiven && (
                            <a
                              href={giftData.amazon_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Buy on Amazon"
                              title="Buy on Amazon"
                              className="surface-raised inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-px"
                            >
                              <ShoppingCart className="size-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAssignment(assignment.id)}
                            aria-label={`Remove ${title}`}
                            className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)] hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      );
                    })}

                    {hiddenGiven > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowGiven(true)}
                        className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
                      >
                        {hiddenGiven} given {hiddenGiven === 1 ? "gift" : "gifts"} hidden
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAssigningTo(recipient.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--background)]"
                    >
                      <span className="flex size-6 items-center justify-center">
                        <Plus className="size-4" />
                      </span>
                      Add gift idea
                    </button>
                  </div>
                </section>
              );
            })}

            {!addingPerson && (
              <button
                type="button"
                onClick={() => setAddingPerson(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] py-3.5 text-sm font-medium text-muted-foreground hover:bg-[var(--muted)]"
              >
                <UserPlus className="size-4" />
                Add a person
              </button>
            )}
          </>
        )}

        {giftIdeas.length === 0 && recipients.length > 0 && (
          <p className="px-4 text-center text-xs text-muted-foreground">
            Text a TikTok or Reel with a product in it to save gift ideas.
          </p>
        )}
      </div>

      {/* Per-person actions */}
      <ActionDrawer
        open={menuFor !== null}
        onOpenChange={(open) => !open && setMenuFor(null)}
        title={recipients.find((r) => r.id === menuFor)?.name ?? "Person"}
      >
        <DrawerItem
          icon={Pencil}
          onClick={() => {
            const recipient = recipients.find((r) => r.id === menuFor);
            if (recipient) {
              setEditingId(recipient.id);
              setEditName(recipient.name);
            }
            setMenuFor(null);
          }}
        >
          Rename
        </DrawerItem>
        <DrawerSeparator />
        <DrawerItem
          icon={Trash2}
          destructive
          onClick={() => {
            const id = menuFor;
            setMenuFor(null);
            if (id) deleteRecipient(id);
          }}
        >
          Delete person
        </DrawerItem>
      </ActionDrawer>

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
            className="top-auto bottom-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:bottom-auto md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] w-full max-w-full sm:max-w-full md:max-w-lg rounded-t-3xl rounded-b-none md:rounded-b-3xl p-0 gap-0 max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Plain white: the old gradient faded to white exactly where the
                white close button sat, so the button vanished. */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
              <DialogTitle className="heading-2 leading-tight">
                Gift for{" "}
                {recipients.find((r) => r.id === assigningTo)?.name}
              </DialogTitle>
              <DialogClose
                aria-label="Close"
                className="surface-raised inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-px"
              >
                <X className="size-4" />
              </DialogClose>
            </div>

            {/* One field: filters saved ideas, or becomes a quick note */}
            <form
              className="px-4 pb-3 border-b border-[var(--border)]"
              onSubmit={(e) => {
                e.preventDefault();
                addGiftNote(assigningTo);
              }}
            >
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search saved ideas, or type a gift"
                  aria-label="Search saved ideas, or type a gift"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 text-sm"
                  enterKeyHint="done"
                />
              </div>
            </form>

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[var(--border)]">
              {/* The typed text as a note first, then saved ideas */}
              {searchQuery.trim() && (
                <button
                  onClick={() => addGiftNote(assigningTo)}
                  disabled={addingNote}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-[var(--background)] transition-colors disabled:opacity-60"
                >
                  <div className="size-12 shrink-0 rounded-xl bg-[var(--gift-bg)] flex items-center justify-center">
                    <PenLine className="size-5 text-[var(--gift)]" />
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
                  <Plus className="size-4 text-[var(--primary)] shrink-0" />
                </button>
              )}

              {getFilteredGifts(assigningTo).map((gift) => {
                const giftData = gift.data as GiftIdeaData;
                return (
                  <button
                    key={gift.id}
                    onClick={() => assignGift(assigningTo, gift.id)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-[var(--background)] transition-colors"
                  >
                    {gift.thumbnail_url && (
                      <img
                        src={gift.thumbnail_url}
                        alt=""
                        className="size-12 object-cover shrink-0 rounded-xl"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{gift.title}</p>
                      {giftData?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {giftData.description}
                        </p>
                      )}
                    </div>
                    {displayPrice(giftData?.cost) && (
                      <span className="surface-inset shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                        {displayPrice(giftData?.cost)}
                      </span>
                    )}
                  </button>
                );
              })}

              {getFilteredGifts(assigningTo).length === 0 &&
                !searchQuery.trim() && (
                  <div className="text-center py-8 px-4 text-muted-foreground">
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
