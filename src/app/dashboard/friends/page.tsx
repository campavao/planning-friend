"use client";

import { InitialsAvatar } from "@/components/initials-avatar";
import { ListGroup } from "@/components/list-group";
import { HEADER_ACTION_CLASS, PageHeader } from "@/components/page-header";
import {
  ActionDrawer,
  DrawerItem,
  DrawerSeparator,
} from "@/components/ui/action-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Friend } from "@/lib/supabase";
import { formatPhoneNumber } from "@/lib/utils";
import {
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Star,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-config";
import { useSession } from "../useSession";
import { ListSkeleton } from "@/components/Skeletons";

// Type for Contact Picker API
interface ContactInfo {
  name?: string[];
  tel?: string[];
}

// Extend Navigator type for Contact Picker API
declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean }
      ) => Promise<ContactInfo[]>;
    };
  }
}

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddManual, setShowAddManual] = useState(false);
  const [newFriendName, setNewFriendName] = useState("");
  const [newFriendPhone, setNewFriendPhone] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Friend | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session handling (redirect to login if unauthenticated) matches the rest
  // of the dashboard.
  const { isLoading: sessionLoading } = useSession();

  const {
    data,
    isLoading: friendsLoading,
    mutate,
  } = useSWR<{ friends: Friend[] }>("/api/friends", fetcher);

  const friends = data?.friends ?? [];
  const loading = sessionLoading || (friendsLoading && !data);

  // Re-fetch the list after a mutation.
  const fetchFriends = useCallback(() => {
    mutate();
  }, [mutate]);

  // Parse vCard file content
  const parseVCard = (
    content: string
  ): { name: string; phoneNumber?: string }[] => {
    const contacts: { name: string; phoneNumber?: string }[] = [];
    const vcards = content.split("END:VCARD");

    for (const vcard of vcards) {
      if (!vcard.includes("BEGIN:VCARD")) continue;

      let name = "";
      let phone = "";

      const fnMatch = vcard.match(/FN[;:][^\r\n]*?:?([^\r\n]+)/i);
      if (fnMatch) {
        name = fnMatch[1].trim();
      }

      if (!name) {
        const nMatch = vcard.match(/^N[;:][^\r\n]*?:?([^\r\n]+)/im);
        if (nMatch) {
          const parts = nMatch[1].split(";");
          name = `${parts[1] || ""} ${parts[0] || ""}`.trim();
        }
      }

      const telMatch = vcard.match(/TEL[;:][^\r\n]*?:?([+\d\s()-]+)/i);
      if (telMatch) {
        phone = telMatch[1].trim();
      }

      if (name) {
        contacts.push({ name, phoneNumber: phone || undefined });
      }
    }

    return contacts;
  };

  const handleFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingContacts(true);

    try {
      const content = await file.text();
      const contacts = parseVCard(content);

      if (contacts.length === 0) {
        alert("No valid contacts found in file");
        return;
      }

      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Added ${data.imported} friend${data.imported !== 1 ? "s" : ""}!`);
        fetchFriends();
      }
    } catch (error) {
      console.error("Failed to import contacts:", error);
      alert("Failed to import contacts from file");
    } finally {
      setImportingContacts(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportContacts = async () => {
    if (navigator.contacts) {
      setImportingContacts(true);

      try {
        const contacts = await navigator.contacts.select(["name", "tel"], {
          multiple: true,
        });

        if (contacts && contacts.length > 0) {
          const formattedContacts = contacts
            .filter((c) => c.name?.[0])
            .map((c) => ({
              name: c.name![0],
              phoneNumber: c.tel?.[0] || undefined,
            }));

          if (formattedContacts.length === 0) {
            alert("No valid contacts selected");
            return;
          }

          const res = await fetch("/api/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contacts: formattedContacts }),
          });

          if (res.ok) {
            const data = await res.json();
            alert(
              `Added ${data.imported} friend${data.imported !== 1 ? "s" : ""}!`
            );
            fetchFriends();
          }
        }
      } catch (error) {
        if ((error as Error).name !== "InvalidStateError") {
          console.error("Failed to import contacts:", error);
        }
      } finally {
        setImportingContacts(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleAddFriend = async () => {
    if (!newFriendName.trim() || !newFriendPhone.trim()) return;

    const phoneDigits = newFriendPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      alert("Please enter a valid phone number");
      return;
    }

    setAddingFriend(true);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFriendName.trim(),
          phoneNumber: newFriendPhone.trim(),
        }),
      });

      if (res.ok) {
        setNewFriendName("");
        setNewFriendPhone("");
        setShowAddManual(false);
        fetchFriends();
      }
    } catch (error) {
      console.error("Failed to add friend:", error);
    } finally {
      setAddingFriend(false);
    }
  };

  const handleToggleFavorite = async (friend: Friend) => {
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: friend.id,
          is_favorite: !friend.is_favorite,
        }),
      });

      if (res.ok) {
        fetchFriends();
      }
    } catch (error) {
      console.error("Failed to update friend:", error);
    }
  };

  const handleUpdateName = async (friendId: string) => {
    if (!editName.trim()) return;

    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: friendId,
          name: editName.trim(),
        }),
      });

      if (res.ok) {
        setEditingId(null);
        setEditName("");
        fetchFriends();
      }
    } catch (error) {
      console.error("Failed to update friend:", error);
    }
  };

  const handleDeleteFriend = async (friendId: string) => {
    if (!confirm("Remove this friend?")) return;

    try {
      const res = await fetch(`/api/friends?id=${friendId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchFriends();
      }
    } catch (error) {
      console.error("Failed to delete friend:", error);
    }
  };

  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      friend.name.toLowerCase().includes(query) ||
      (friend.phone_number && friend.phone_number.includes(query))
    );
  });
  const favorites = filteredFriends.filter((friend) => friend.is_favorite);
  const everyone = filteredFriends.filter((friend) => !friend.is_favorite);

  const header = (
    <PageHeader
      title="Friends"
      count={loading ? undefined : friends.length}
      backHref="/dashboard"
      action={
        <button
          type="button"
          onClick={() => setAddMenuOpen(true)}
          aria-label="Add friends"
          className={HEADER_ACTION_CLASS}
        >
          <Plus className="size-5" />
        </button>
      }
    />
  );

  if (loading) {
    return (
      <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
        {header}
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
          <ListSkeleton count={5} />
        </div>
      </main>
    );
  }

  const renderRow = (friend: Friend) => (
    <div key={friend.id} className="flex items-center gap-3 px-4 py-3">
      <InitialsAvatar name={friend.name} />
      {editingId === friend.id ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdateName(friend.id);
          }}
        >
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
            aria-label="Name"
            className="h-9 flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" variant="secondary">
            Save
          </Button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{friend.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {friend.phone_number && (
                <span>{formatPhoneNumber(friend.phone_number)}</span>
              )}
              {friend.linked_user_id && (
                <span className="surface-inset inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  <Check className="size-3 text-[var(--secondary-dark)]" />
                  On Planning Friend
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuFor(friend)}
            aria-label={`Options for ${friend.name}`}
            className="surface-raised inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
      {header}

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-1 pb-6 space-y-6">
        {/* Hidden file input for vCard import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          onChange={handleFileImport}
          className="hidden"
        />

        {friends.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search friends"
              aria-label="Search friends"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
        )}

        {importingContacts && (
          <p className="text-sm text-muted-foreground">Importing contacts…</p>
        )}

        {/* Manual Add Form */}
        {showAddManual && (
          <ListGroup label="Add a friend">
            <form
              className="p-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddFriend();
              }}
            >
              <Input
                placeholder="Name"
                aria-label="Name"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                autoFocus
              />
              <Input
                type="tel"
                placeholder="Phone number"
                aria-label="Phone number"
                value={newFriendPhone}
                onChange={(e) =>
                  setNewFriendPhone(formatPhoneNumber(e.target.value))
                }
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    addingFriend ||
                    !newFriendName.trim() ||
                    newFriendPhone.replace(/\D/g, "").length < 10
                  }
                  variant="secondary"
                  className="flex-1"
                >
                  {addingFriend ? "Adding..." : "Add Friend"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowAddManual(false);
                    setNewFriendName("");
                    setNewFriendPhone("");
                  }}
                  className="surface-raised rounded-full"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </ListGroup>
        )}

        {/* Friends List — favourites first, as their own group, rather than
            a star column that only said the same thing row by row. */}
        {filteredFriends.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--meal-bg)] flex items-center justify-center">
              <Users className="w-8 h-8 text-[var(--secondary-dark)]" />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {searchQuery ? "No friends found" : "No friends yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery
                ? "Try a different name or number"
                : "Add friends to share your plans with them."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setAddMenuOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add friends
              </Button>
            )}
          </div>
        ) : (
          <>
            {favorites.length > 0 && (
              <ListGroup label="Favorites">{favorites.map(renderRow)}</ListGroup>
            )}
            {everyone.length > 0 && (
              <ListGroup label={favorites.length > 0 ? "Everyone" : undefined}>
                {everyone.map(renderRow)}
              </ListGroup>
            )}
          </>
        )}
      </div>

      <ActionDrawer
        open={addMenuOpen}
        onOpenChange={setAddMenuOpen}
        title="Add friends"
      >
        <DrawerItem
          icon={Smartphone}
          onClick={() => {
            setAddMenuOpen(false);
            handleImportContacts();
          }}
        >
          Import from contacts
        </DrawerItem>
        <DrawerItem
          icon={UserPlus}
          onClick={() => {
            setAddMenuOpen(false);
            setShowAddManual(true);
          }}
        >
          Add by phone number
        </DrawerItem>
      </ActionDrawer>

      {/* Per-friend actions. They used to appear on hover, which a phone
          never does — so on mobile a friend couldn't be renamed or removed. */}
      <ActionDrawer
        open={menuFor !== null}
        onOpenChange={(open) => !open && setMenuFor(null)}
        title={menuFor?.name ?? "Friend"}
      >
        {menuFor && (
          <>
            <DrawerItem
              icon={Star}
              onClick={() => {
                handleToggleFavorite(menuFor);
                setMenuFor(null);
              }}
            >
              {menuFor.is_favorite ? "Remove from favorites" : "Add to favorites"}
            </DrawerItem>
            <DrawerItem
              icon={Pencil}
              onClick={() => {
                setEditingId(menuFor.id);
                setEditName(menuFor.name);
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
                const id = menuFor.id;
                setMenuFor(null);
                handleDeleteFriend(id);
              }}
            >
              Remove friend
            </DrawerItem>
          </>
        )}
      </ActionDrawer>
    </main>
  );
}
