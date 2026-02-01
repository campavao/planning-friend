"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Friend } from "@/lib/supabase";
import { formatPhoneNumber } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  Smartphone,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddManual, setShowAddManual] = useState(false);
  const [newFriendName, setNewFriendName] = useState("");
  const [newFriendPhone, setNewFriendPhone] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");

      if (res.status === 401) {
        router.push("/");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--secondary)] px-4 py-5">
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
          <h1 className="heading-1 text-white">
            Friends
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-4 py-6">
        {/* Search Bar */}
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-modern w-full"
          />
        </div>

        {/* Hidden file input for vCard import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          onChange={handleFileImport}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={handleImportContacts}
            disabled={importingContacts}
            variant="outline"
            className="flex-1 rounded-xl border-[var(--border)] hover:bg-[var(--muted)]"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            {importingContacts ? "Importing..." : "Import Contacts"}
          </Button>
          <Button
            onClick={() => setShowAddManual(!showAddManual)}
            className="flex-1 btn-secondary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Manually
          </Button>
        </div>

        {/* Manual Add Form */}
        {showAddManual && (
          <div className="card-elevated mb-6">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--secondary)]/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[var(--secondary)]" />
                </div>
                Add a Friend
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <Input
                placeholder="Name *"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                className="input-modern"
                autoFocus
              />
              <Input
                type="tel"
                placeholder="Phone number *"
                value={newFriendPhone}
                onChange={(e) =>
                  setNewFriendPhone(formatPhoneNumber(e.target.value))
                }
                className="input-modern"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddFriend}
                  disabled={
                    addingFriend ||
                    !newFriendName.trim() ||
                    newFriendPhone.replace(/\D/g, "").length < 10
                  }
                  className="flex-1 btn-secondary"
                >
                  {addingFriend ? "Adding..." : "Add Friend"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAddManual(false);
                    setNewFriendName("");
                    setNewFriendPhone("");
                  }}
                  className="rounded-xl border border-[var(--border)]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Friends List */}
        {filteredFriends.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--secondary)]/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-[var(--secondary)]" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {searchQuery ? "No friends found" : "No friends yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "Try a different search term"
                : "Add friends to share your plans with them!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="card-elevated p-4 flex items-center gap-3 group"
              >
                {/* Favorite Star */}
                <button
                  onClick={() => handleToggleFavorite(friend)}
                  className="transition-transform hover:scale-110"
                  title={
                    friend.is_favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                >
                  <Star
                    className={`w-5 h-5 ${
                      friend.is_favorite
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>

                {/* Friend Info */}
                <div className="flex-1 min-w-0">
                  {editingId === friend.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleUpdateName(friend.id)
                        }
                        className="input-modern flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateName(friend.id)}
                        className="btn-secondary"
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
                      <p className="font-medium truncate">{friend.name}</p>
                      {friend.phone_number && (
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(friend.phone_number)}
                        </p>
                      )}
                      {friend.linked_user_id && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--primary)]">
                          <Check className="w-3 h-3" />
                          Planning Friend user
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== friend.id && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(friend.id);
                        setEditName(friend.name);
                      }}
                      className="rounded-lg hover:bg-[var(--muted)]"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteFriend(friend.id)}
                      className="rounded-lg text-destructive hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
