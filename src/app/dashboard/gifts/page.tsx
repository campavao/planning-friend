"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  Content,
  GiftAssignment,
  GiftIdeaData,
  GiftRecipientWithAssignments,
} from "@/lib/supabase";
import {
  ArrowLeft,
  ExternalLink,
  Gift,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function GiftPlannerPage() {
  const [recipients, setRecipients] = useState<GiftRecipientWithAssignments[]>(
    []
  );
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

      if (recipientsRes.status === 401 || giftsRes.status === 401) {
        router.push("/");
        return;
      }

      if (recipientsRes.ok) {
        const recipientsData = await recipientsRes.json();
        setRecipients(recipientsData.recipients || []);
      } else {
        console.warn("Failed to fetch recipients (tables may not exist yet)");
        setRecipients([]);
      }

      if (giftsRes.ok) {
        const giftsData = await giftsRes.json();
        setGiftIdeas(giftsData.giftIdeas || []);
      } else {
        console.warn("Failed to fetch gift ideas");
        setGiftIdeas([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
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
    if (!confirm("Delete this person? All gift assignments will be removed."))
      return;

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
    const assignedIds = new Set(
      recipient?.assignments.map((a) => a.content_id) || []
    );

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--accent)] px-4 py-5">
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
            Gift Ideas
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-4 py-6">
        {/* Add New Person */}
        <div className="card-elevated mb-6">
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
              className="input-modern flex-1"
            />
            <Button onClick={addRecipient} className="btn-secondary">
              <Gift className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {/* Recipients List */}
        {recipients.length === 0 ? (
          <div className="card-elevated p-8 text-center">
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
          </div>
        ) : (
          <div className="space-y-4">
            {recipients.map((recipient) => (
              <Card key={recipient.id} className="card-elevated overflow-hidden">
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
                          className="input-modern flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => updateRecipient(recipient.id)}
                          className="btn-primary"
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
                          <Badge className="badge ml-2 bg-[var(--accent)]/10 text-[var(--accent)]">
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
                      {recipient.assignments.map(
                        (assignment: GiftAssignment) => {
                          const giftData = assignment.content
                            ?.data as GiftIdeaData;
                          return (
                            <div
                              key={assignment.id}
                              className="group flex items-center gap-3 bg-[var(--muted)] rounded-xl p-3"
                            >
                              {assignment.content?.thumbnail_url && (
                                <img
                                  src={assignment.content.thumbnail_url}
                                  alt=""
                                  className="w-12 h-12 object-cover shrink-0 rounded-lg"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm line-clamp-1">
                                  {assignment.content?.title}
                                </p>
                                {giftData?.cost && (
                                  <p className="text-sm text-[var(--accent)] font-semibold">
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
                                    className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                                  >
                                    <ShoppingCart className="w-3 h-3" />
                                    Amazon
                                  </a>
                                )}
                                <button
                                  onClick={() =>
                                    removeAssignment(assignment.id)
                                  }
                                  className="text-destructive hover:bg-red-50 p-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        }
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
          <div className="card-elevated p-6 mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              No gift ideas saved yet. Text a TikTok or Instagram with product
              recommendations to save gift ideas!
            </p>
          </div>
        )}
      </div>

      {/* Assign Gift Modal */}
      {assigningTo !== null && (
        <div className="fixed inset-0 modal-backdrop z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-[var(--card)] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dark)] md:rounded-t-2xl">
              <h3 className="font-semibold text-white">
                Add Gift for{" "}
                {recipients.find((r) => r.id === assigningTo)?.name}
              </h3>
              <button
                onClick={() => {
                  setAssigningTo(null);
                  setSearchQuery("");
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[var(--border)] bg-white">
              <Input
                type="text"
                placeholder="Search gift ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-modern w-full"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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

              {getFilteredGifts(assigningTo).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--muted)] flex items-center justify-center">
                    <Gift className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-sm">No gift ideas available</p>
                  {giftIdeas.length === 0 && (
                    <p className="text-xs mt-2">
                      Text product TikToks or Reels to save gift ideas!
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
