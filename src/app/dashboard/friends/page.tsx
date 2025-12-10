"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Friend } from "@/lib/supabase";
import { formatPhoneNumber } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

  const handleImportContacts = async () => {
    // Check if running as standalone PWA (required for iOS)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    // Detect iOS
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (!navigator.contacts) {
      if (isIOS && !isStandalone) {
        alert(
          "To import contacts on iOS, you need to add this app to your home screen first.\n\n" +
            "Tap the Share button (square with arrow) → 'Add to Home Screen', then open the app from there."
        );
      } else {
        alert(
          "Contact import is not supported on this device/browser. Try using Chrome on Android, or on iOS add this app to your home screen first."
        );
      }
      return;
    }

    setImportingContacts(true);

    try {
      const contacts = await navigator.contacts.select(["name", "tel"], {
        multiple: true,
      });

      if (contacts && contacts.length > 0) {
        // Format contacts for API
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
      // User cancelled or error occurred
      if ((error as Error).name !== "InvalidStateError") {
        console.error("Failed to import contacts:", error);
      }
    } finally {
      setImportingContacts(false);
    }
  };

  const handleAddFriend = async () => {
    if (!newFriendName.trim() || !newFriendPhone.trim()) return;

    // Validate phone number has at least 10 digits
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

  // Filter friends by search query
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
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-shimmer w-16 h-16 rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-paper">
      {/* Scrapbook Header */}
      <div className="pt-6 pb-4 px-4 md:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-washi-mint/20"
            >
              ← Back
            </Button>
          </Link>
          <div className="relative">
            <h1 className="font-handwritten text-3xl md:text-4xl text-foreground transform -rotate-1">
              Friends
            </h1>
            <div className="absolute -bottom-1 left-0 right-0 h-2 bg-washi-lavender/60 transform rotate-0.5 -z-10" />
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-4">
        {/* Search Bar */}
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-border"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={handleImportContacts}
            disabled={importingContacts}
            variant="outline"
            className="flex-1 hover:bg-washi-mint/20"
          >
            {importingContacts ? "Importing..." : "📱 Import Contacts"}
          </Button>
          <Button
            onClick={() => setShowAddManual(!showAddManual)}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            ➕ Add Manually
          </Button>
        </div>

        {/* Manual Add Form */}
        {showAddManual && (
          <div className="scrapbook-card p-5 mb-6 relative">
            <div className="absolute -top-2 left-8 w-16 h-5 bg-washi-pink/80 transform -rotate-2" />
            <h2 className="font-handwritten text-xl mb-3 pt-2">Add a Friend</h2>
            <div className="space-y-3">
              <Input
                placeholder="Name *"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                className="bg-white border-border"
                autoFocus
              />
              <Input
                type="tel"
                placeholder="Phone number *"
                value={newFriendPhone}
                onChange={(e) =>
                  setNewFriendPhone(formatPhoneNumber(e.target.value))
                }
                className="bg-white border-border"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddFriend}
                  disabled={
                    addingFriend ||
                    !newFriendName.trim() ||
                    newFriendPhone.replace(/\D/g, "").length < 10
                  }
                  className="flex-1 bg-primary hover:bg-primary/90"
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
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Friends List */}
        {filteredFriends.length === 0 ? (
          <div className="scrapbook-card p-8 text-center relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-washi-yellow/80 transform -rotate-1" />
            <div className="text-6xl mb-4 pt-2">👥</div>
            <h3 className="font-handwritten text-2xl mb-2">
              {searchQuery ? "No friends found" : "No friends yet"}
            </h3>
            <p className="text-muted-foreground">
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
                className="scrapbook-card p-4 flex items-center gap-3 group hover:shadow-md transition-shadow"
              >
                {/* Favorite Star */}
                <button
                  onClick={() => handleToggleFavorite(friend)}
                  className="text-2xl transition-transform hover:scale-110"
                  title={
                    friend.is_favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                >
                  {friend.is_favorite ? "⭐" : "☆"}
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
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateName(friend.id)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
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
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <span>✓</span> Planning Friend user
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
                      className="hover:bg-washi-blue/20"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteFriend(friend.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      ✕
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
