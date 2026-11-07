"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { AddToggle } from "@/components/add-toggle";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type { GiftRecipientWithAssignments } from "@/lib/supabase";
import { fetcher } from "@/lib/swr-config";

const RECIPIENTS_KEY = "/api/gifts/recipients?include=assignments";

/**
 * Put a gift on people's lists. Each person shows whether this gift is already
 * on their list, and tapping toggles it — the old picker added on every tap,
 * so tapping someone twice gave them the same gift twice. Someone not on the
 * list yet can be added right here instead of a trip to the Gifts page.
 */
export function GiveSheet({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  onGiven,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  /** After adding it to someone's list, with their name. */
  onGiven: (name: string) => void;
}) {
  const { data, mutate } = useSWR<{
    recipients: GiftRecipientWithAssignments[];
  }>(open ? RECIPIENTS_KEY : null, fetcher);
  const recipients = data?.recipients;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const assignmentFor = (recipient: GiftRecipientWithAssignments) =>
    recipient.assignments.find((a) => a.content_id === contentId);

  const give = async (recipientId: string, name: string) => {
    const res = await fetch("/api/gifts/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, contentId }),
    });
    if (!res.ok) throw new Error("Failed to add gift");
    onGiven(name);
  };

  const toggle = async (recipient: GiftRecipientWithAssignments) => {
    setPendingId(recipient.id);
    try {
      const existing = assignmentFor(recipient);
      if (existing) {
        await fetch(`/api/gifts/assignments?id=${existing.id}`, {
          method: "DELETE",
        });
      } else {
        await give(recipient.id, recipient.name);
      }
      await mutate();
    } catch (error) {
      console.error("Failed to update gift list:", error);
    } finally {
      setPendingId(null);
    }
  };

  const addPerson = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/gifts/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to add person");
      const { recipient } = (await res.json()) as {
        recipient: { id: string; name: string };
      };
      await give(recipient.id, recipient.name);
      setNewName("");
      setAddingPerson(false);
      await mutate();
    } catch (error) {
      console.error("Failed to add person:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAddingPerson(false);
          setNewName("");
        }
        onOpenChange(next);
      }}
      title="Give to someone"
      subtitle={contentTitle}
      footer={
        <Button className="w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      {recipients === undefined ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {recipients.map((recipient) => {
            const onList = !!assignmentFor(recipient);
            const ideas = recipient.assignments.length;
            return (
              <li
                key={recipient.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <InitialsAvatar name={recipient.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">
                    {recipient.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {onList
                      ? "On their list"
                      : ideas === 0
                        ? "No ideas yet"
                        : `${ideas} ${ideas === 1 ? "idea" : "ideas"}`}
                  </p>
                </div>
                <AddToggle
                  added={onList}
                  pending={pendingId === recipient.id}
                  label={`for ${recipient.name}`}
                  onToggle={() => toggle(recipient)}
                />
              </li>
            );
          })}
          <li className="px-4 py-2.5">
            {addingPerson ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPerson();
                }}
              >
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setAddingPerson(false)}
                  placeholder="Their name"
                  aria-label="New person's name"
                  className="h-10 flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={!newName.trim() || creating}>
                  {creating ? "Adding…" : "Add"}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPerson(true)}
                className="flex w-full items-center gap-3 text-left text-[15px] font-medium text-[var(--primary)]"
              >
                <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)]">
                  <UserPlus className="size-4" />
                </span>
                New person
              </button>
            )}
          </li>
        </ul>
      )}
    </Sheet>
  );
}
