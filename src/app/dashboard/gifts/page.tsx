"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  Content,
  GiftRecipientWithAssignments,
  GiftAssignment,
  GiftIdeaData,
} from "@/lib/supabase";

export default function GiftPlannerPage() {
  const [recipients, setRecipients] = useState<GiftRecipientWithAssignments[]>([]);
  const [giftIdeas, setGiftIdeas] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const [recipientsRes, giftsRes] = await Promise.all([
        fetch("/api/gifts/recipients?include=assignments"),
        fetch("/api/gifts/assignments"),
      ]);

      // Check for auth errors
      if (recipientsRes.status === 401 || giftsRes.status === 401) {
        router.push("/");
        return;
      }

      // Handle recipients response (may fail if tables don't exist yet)
      if (recipientsRes.ok) {
        const recipientsData = await recipientsRes.json();
        setRecipients(recipientsData.recipients || []);
      } else {
        console.warn("Failed to fetch recipients (tables may not exist yet)");
        setRecipients([]);
      }

      // Handle gifts response
      if (giftsRes.ok) {
        const giftsData = await giftsRes.json();
        setGiftIdeas(giftsData.giftIdeas || []);
      } else {
        console.warn("Failed to fetch gift ideas");
        setGiftIdeas([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Don't redirect, just show empty state
      setRecipients([]);
      setGiftIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        fetchData();
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
        fetchData();
      }
    } catch (error) {
      console.error("Failed to update recipient:", error);
    }
  };

  const deleteRecipient = async (id: string) => {
    if (!confirm("Delete this person? All gift assignments will be removed.")) return;

    try {
      const res = await fetch(`/api/gifts/recipients?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete recipient:", error);
    }
  };

  const assignGift = async (recipientId: string, contentId: string) => {
    try {
      const res = await fetch("/api/gifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, contentId }),
      });

      if (res.ok) {
        setAssigningTo(null);
        setSearchQuery("");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to assign gift:", error);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/gifts/assignments?id=${assignmentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to remove assignment:", error);
    }
  };

  const getFilteredGifts = (recipientId: string) => {
    const recipient = recipients.find((r) => r.id === recipientId);
    const assignedIds = new Set(recipient?.assignments.map((a) => a.content_id) || []);

    return giftIdeas.filter((g) => {
      if (assignedIds.has(g.id)) return false;
      if (searchQuery) {
        return g.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-shimmer w-16 h-16 rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-20 md:pb-8">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="px-2 md:px-3">
              ← <span className="hidden sm:inline ml-1">Back</span>
            </Button>
          </Link>
          <div className="text-center flex-1">
            <h1 className="font-semibold text-sm md:text-lg">Gift Planner</h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Add New Person */}
        <Card className="glass mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add a Person</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter name (e.g., Mom, Dad, Best Friend)"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                className="flex-1"
              />
              <Button onClick={addRecipient}>Add</Button>
            </div>
          </CardContent>
        </Card>

        {/* Recipients List */}
        {recipients.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-xl font-semibold mb-2">No people added yet</h3>
            <p className="text-muted-foreground mb-4">
              Add people you want to give gifts to, then assign gift ideas to them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recipients.map((recipient) => (
              <Card key={recipient.id} className="glass overflow-hidden">
                <CardHeader className="pb-2">
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
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <span>👤</span> {recipient.name}
                          <Badge variant="secondary" className="ml-2">
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
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteRecipient(recipient.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Assigned Gifts */}
                  {recipient.assignments.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {recipient.assignments.map((assignment: GiftAssignment) => {
                        const giftData = assignment.content?.data as GiftIdeaData;
                        return (
                          <div
                            key={assignment.id}
                            className="group flex items-center gap-3 glass rounded-lg p-3"
                          >
                            {assignment.content?.thumbnail_url && (
                              <img
                                src={assignment.content.thumbnail_url}
                                alt=""
                                className="w-12 h-12 object-cover rounded-lg shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium line-clamp-1">
                                {assignment.content?.title}
                              </p>
                              {giftData?.cost && (
                                <p className="text-sm text-gift">
                                  {giftData.cost}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {giftData?.amazon_link && (
                                <a
                                  href={giftData.amazon_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-orange-400 hover:underline"
                                >
                                  Amazon
                                </a>
                              )}
                              <button
                                onClick={() => removeAssignment(assignment.id)}
                                className="text-destructive hover:bg-destructive/20 rounded p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Gift Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => setAssigningTo(recipient.id)}
                  >
                    + Add Gift Idea
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State for Gift Ideas */}
        {giftIdeas.length === 0 && recipients.length > 0 && (
          <div className="glass rounded-2xl p-6 mt-6 text-center">
            <p className="text-muted-foreground">
              No gift ideas saved yet. Text a TikTok with product recommendations to save gift ideas!
            </p>
          </div>
        )}
      </div>

      {/* Assign Gift Modal */}
      {assigningTo !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="glass w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">
                Add Gift for {recipients.find((r) => r.id === assigningTo)?.name}
              </h3>
              <button
                onClick={() => {
                  setAssigningTo(null);
                  setSearchQuery("");
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-border">
              <Input
                type="text"
                placeholder="Search gift ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>

            {/* Gift List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {getFilteredGifts(assigningTo).map((gift) => {
                const giftData = gift.data as GiftIdeaData;
                return (
                  <button
                    key={gift.id}
                    onClick={() => assignGift(assigningTo, gift.id)}
                    className="w-full glass rounded-xl p-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3"
                  >
                    {gift.thumbnail_url && (
                      <img
                        src={gift.thumbnail_url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">{gift.title}</p>
                      {giftData?.cost && (
                        <p className="text-sm text-gift">{giftData.cost}</p>
                      )}
                      {giftData?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {giftData.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

              {getFilteredGifts(assigningTo).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No gift ideas available</p>
                  {giftIdeas.length === 0 && (
                    <p className="text-sm mt-2">
                      Text product TikToks to save gift ideas!
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

