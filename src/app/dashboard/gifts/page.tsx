"use client";

import { AddToggle } from "@/components/add-toggle";
import { InitialsAvatar } from "@/components/initials-avatar";
import { HEADER_ACTION_CLASS, PageHeader } from "@/components/page-header";
import {
  ActionDrawer,
  DrawerItem,
  DrawerSeparator,
} from "@/components/ui/action-drawer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetSection } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import type {
  Content,
  GiftAssignment,
  GiftIdeaData,
  GiftRecipientWithAssignments,
} from "@/lib/supabase";
import {
  ArrowUp,
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

export default function GiftPlannerPage() {
  const [newRecipientName, setNewRecipientName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGiven, setShowGiven] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [pendingGiftId, setPendingGiftId] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

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

  /**
   * Put a saved idea on someone's list, or take it off. The sheet stays open:
   * a list is usually built several ideas at a time.
   */
  const toggleGift = async (recipientId: string, contentId: string) => {
    const recipient = recipients.find((r) => r.id === recipientId);
    const existing = recipient?.assignments.find(
      (a) => a.content_id === contentId
    );
    setPendingGiftId(contentId);
    try {
      const res = existing
        ? await fetch(`/api/gifts/assignments?id=${existing.id}`, {
            method: "DELETE",
          })
        : await fetch("/api/gifts/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipientId, contentId }),
          });

      if (res.ok) {
        await mutateRecipients();
      }
    } catch (error) {
      console.error("Failed to update gift list:", error);
    } finally {
      setPendingGiftId(null);
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
        setSearchQuery("");
        await mutateRecipients();
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

  // Every saved idea, including ones already on the list — those show a
  // check that takes them back off.
  const filteredGifts = giftIdeas.filter((g) =>
    searchQuery.trim()
      ? g.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      : true
  );

  const assigningRecipient =
    recipients.find((r) => r.id === assigningTo) ?? null;
  const assigningNotes =
    assigningRecipient?.assignments.filter(
      (a: GiftAssignment) => !a.content_id && !a.given_at
    ) ?? [];

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
                              <span className="surface-inset mt-1 inline-block max-w-full truncate rounded-full px-2 py-0.5 align-top text-xs font-semibold">
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

      {/* Add gifts for a person */}
      {assigningRecipient && (
        <Sheet
          open
          onOpenChange={(o) => {
            if (!o) closeAssignDrawer();
          }}
          title={`Gift for ${assigningRecipient.name}`}
          top={
            <>
              {/* Whose list, switchable without closing — shopping for one
                  person tends to turn up ideas for the next. */}
              {recipients.length > 1 && (
                // Room for the chips' shadows inside the scroller, which
                // clips vertically too. Only the top is handed back: the
                // bottom padding is the gap to the search field.
                <div className="-mx-4 -mt-1.5 -mb-1 overflow-x-auto hide-scrollbar">
                  <div className="flex w-max gap-2 px-4 pt-1.5 pb-3">
                    {recipients.map((recipient) => {
                      const selected = recipient.id === assigningRecipient.id;
                      return (
                        <button
                          key={recipient.id}
                          type="button"
                          onClick={() => {
                            setAssigningTo(recipient.id);
                            setSearchQuery("");
                          }}
                          aria-pressed={selected}
                          className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition-colors duration-300 active:scale-95 ${
                            selected
                              ? "bg-foreground text-background"
                              : "surface-raised"
                          }`}
                        >
                          <InitialsAvatar
                            name={recipient.name}
                            className="size-6 text-[10px]"
                          />
                          {recipient.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* One field: filters saved ideas, or becomes a quick note */}
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  addGiftNote(assigningRecipient.id);
                }}
              >
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search or type a gift"
                  aria-label="Search saved ideas, or type a gift"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-10 pr-12 text-base"
                  enterKeyHint="send"
                />
                {searchQuery.trim() && (
                  <button
                    type="submit"
                    disabled={addingNote}
                    aria-label={`Add “${searchQuery.trim()}” as a gift`}
                    className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-transform active:scale-95 disabled:opacity-60"
                  >
                    <ArrowUp className="size-4" strokeWidth={2.5} />
                  </button>
                )}
              </form>
            </>
          }
          footer={
            <Button className="w-full" onClick={closeAssignDrawer}>
              Done
            </Button>
          }
        >
          {/* What's typed, as a gift of its own — first, so it's never under
              the fold */}
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => addGiftNote(assigningRecipient.id)}
              disabled={addingNote}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--background)] disabled:opacity-60"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gift-bg)]">
                <PenLine className="size-5 text-[var(--gift)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[15px] font-medium">
                  Add &ldquo;{searchQuery.trim()}&rdquo;
                </span>
                <span className="text-xs text-muted-foreground">
                  {addingNote ? "Saving…" : "No saved item needed"}
                </span>
              </span>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </span>
            </button>
          )}

          {/* Typed gifts already on this list, so a note just added shows up
              with its check like everything else */}
          {assigningNotes.length > 0 && !searchQuery.trim() && (
            <SheetSection label="Typed gifts">
              <ul className="divide-y divide-[var(--border)]">
                {assigningNotes.map((assignment, index) => (
                  <li
                    key={assignment.id}
                    className="sheet-row-in flex items-center gap-3 bg-[var(--meal-bg)]/60 px-4 py-2.5"
                    style={{ "--i": index } as React.CSSProperties}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gift-bg)]">
                      <PenLine className="size-5 text-[var(--gift)]" />
                    </span>
                    <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-medium">
                      {assignment.note_title}
                    </p>
                    <AddToggle
                      added
                      label={assignment.note_title ?? "gift"}
                      onToggle={() => removeAssignment(assignment.id)}
                    />
                  </li>
                ))}
              </ul>
            </SheetSection>
          )}

          <SheetSection
            label="Saved gift ideas"
            action={
              <span className="text-xs text-muted-foreground">
                {filteredGifts.length}
              </span>
            }
          >
            {/* Keyed by person, so switching whose list it is replays the
                cascade and the checks visibly change over. */}
            <ul
              key={assigningRecipient.id}
              className="divide-y divide-[var(--border)]"
            >
              {filteredGifts.map((gift, index) => {
                const giftData = gift.data as GiftIdeaData;
                const price = displayPrice(giftData?.cost);
                const onList = assigningRecipient.assignments.some(
                  (a: GiftAssignment) => a.content_id === gift.id
                );
                return (
                  <li
                    key={gift.id}
                    className={`sheet-row-in flex items-center gap-3 px-4 py-2.5 transition-colors duration-300 ${
                      onList ? "bg-[var(--meal-bg)]/60" : ""
                    }`}
                    style={{ "--i": index } as React.CSSProperties}
                  >
                    {gift.thumbnail_url ? (
                      <img
                        src={gift.thumbnail_url}
                        alt=""
                        className="size-11 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gift-bg)]">
                        <Gift className="size-5 text-[var(--gift)]" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[15px] font-medium">
                        {gift.title}
                      </p>
                      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {price && (
                          // Never wider than half the line, so an odd
                          // price can't push the row past the screen.
                          <span className="surface-inset max-w-[50%] shrink-0 truncate rounded-full px-1.5 py-px font-semibold text-foreground">
                            {price}
                          </span>
                        )}
                        {giftData?.description && (
                          <span className="truncate">{giftData.description}</span>
                        )}
                      </p>
                    </div>
                    <AddToggle
                      added={onList}
                      pending={pendingGiftId === gift.id}
                      label={gift.title}
                      onToggle={() =>
                        toggleGift(assigningRecipient.id, gift.id)
                      }
                    />
                  </li>
                );
              })}
            </ul>
            {filteredGifts.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <p className="text-sm font-medium">
                  {searchQuery.trim()
                    ? "No saved ideas match — add it as a gift above"
                    : "No saved gift ideas yet"}
                </p>
                {!searchQuery.trim() && (
                  <p className="mt-1 text-xs">
                    Type a gift above, or text a product TikTok or Reel to save
                    ideas.
                  </p>
                )}
              </div>
            )}
          </SheetSection>
          <div className="h-4" />
        </Sheet>
      )}
    </main>
  );
}
