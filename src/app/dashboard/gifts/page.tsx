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
        <div className="brutal-loading w-32">
          <div className="brutal-loading-bar" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-background">
      {/* Header */}
      <div className="brutal-header">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="border-[3px] border-border hover:bg-card"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="font-mono text-2xl md:text-3xl font-bold uppercase">
            Gift_Ideas
          </h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-4 py-6">
        {/* Add New Person */}
        <div className="brutal-card-static mb-6">
          <div className="p-4 border-b-[3px] border-border bg-accent">
            <h2 className="font-mono text-lg font-bold uppercase flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add a Person
            </h2>
          </div>
          <div className="p-4 flex gap-2">
            <Input
              placeholder="Enter name (e.g., Mom, Dad, Best Friend)"
              value={newRecipientName}
              onChange={(e) => setNewRecipientName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRecipient()}
              className="brutal-input flex-1"
            />
            <Button onClick={addRecipient} className="brutal-btn">
              <Gift className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {/* Recipients List */}
        {recipients.length === 0 ? (
          <div className="brutal-card-static p-8 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-mono text-xl font-bold uppercase mb-2">
              No people added yet
            </h3>
            <p className="text-muted-foreground">
              Add people you want to give gifts to, then assign gift ideas to
              them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recipients.map((recipient) => (
              <Card key={recipient.id} className="brutal-card-static overflow-hidden">
                <CardHeader className="pb-2 border-b-[3px] border-border bg-card">
                  <div className="flex items-center justify-between">
                    {editingId === recipient.id ? (
                      <div className="flex gap-2 flex-1 mr-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && updateRecipient(recipient.id)
                          }
                          className="brutal-input flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => updateRecipient(recipient.id)}
                          className="brutal-btn"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="border-2 border-border"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <User className="w-5 h-5" />
                          {recipient.name}
                          <Badge className="brutal-badge ml-2">
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
                            className="border-2 border-border"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="border-2 border-destructive text-destructive"
                            onClick={() => deleteRecipient(recipient.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
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
                              className="group flex items-center gap-3 brutal-card-static p-3"
                            >
                              {assignment.content?.thumbnail_url && (
                                <img
                                  src={assignment.content.thumbnail_url}
                                  alt=""
                                  className="w-12 h-12 object-cover shrink-0 border-2 border-border"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium line-clamp-1">
                                  {assignment.content?.title}
                                </p>
                                {giftData?.cost && (
                                  <p className="text-sm font-mono text-gift font-bold">
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
                                    className="text-xs text-orange-500 hover:underline flex items-center gap-1 font-mono"
                                  >
                                    <ShoppingCart className="w-3 h-3" />
                                    Amazon
                                  </a>
                                )}
                                <button
                                  onClick={() =>
                                    removeAssignment(assignment.id)
                                  }
                                  className="text-destructive hover:bg-destructive/20 p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity border border-destructive"
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
                    className="w-full border-2 border-dashed border-border hover:bg-accent"
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
          <div className="brutal-card-static p-6 mt-6 text-center">
            <p className="text-muted-foreground">
              No gift ideas saved yet. Text a TikTok or Instagram with product
              recommendations to save gift ideas!
            </p>
          </div>
        )}
      </div>

      {/* Assign Gift Modal */}
      {assigningTo !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="brutal-card-static w-full md:max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b-[3px] border-border flex items-center justify-between bg-accent">
              <h3 className="font-bold font-mono uppercase">
                Add Gift for{" "}
                {recipients.find((r) => r.id === assigningTo)?.name}
              </h3>
              <button
                onClick={() => {
                  setAssigningTo(null);
                  setSearchQuery("");
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b-[3px] border-border">
              <Input
                type="text"
                placeholder="Search gift ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="brutal-input w-full"
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
                    className="w-full brutal-card p-3 text-left flex items-center gap-3"
                  >
                    {gift.thumbnail_url && (
                      <img
                        src={gift.thumbnail_url}
                        alt=""
                        className="w-16 h-16 object-cover shrink-0 border-2 border-border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">{gift.title}</p>
                      {giftData?.cost && (
                        <p className="text-sm font-mono text-gift font-bold">
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
                  <Gift className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-mono uppercase">No gift ideas available</p>
                  {giftIdeas.length === 0 && (
                    <p className="text-sm mt-2">
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
