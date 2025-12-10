"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NamePromptModalProps {
  onComplete: (name: string) => void;
}

export function NamePromptModal({ onComplete }: NamePromptModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (name.trim().length > 100) {
      setError("Name is too long (max 100 characters)");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/users/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save name");
      }

      // Mark as seen in localStorage
      localStorage.setItem("hasSeenNamePrompt", "true");

      onComplete(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="scrapbook-card w-full max-w-md relative overflow-visible animate-fade-in-up">
        {/* Washi tape decorations */}
        <div className="absolute -top-3 left-8 w-20 h-6 bg-washi-mint/80 transform -rotate-2 z-10" />
        <div className="absolute -top-3 right-12 w-16 h-6 bg-washi-pink/80 transform rotate-1 z-10" />

        <div className="p-6 pt-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">
              <span role="img" aria-label="wave">
                👋
              </span>
            </div>
            <h2 className="font-handwritten text-3xl mb-2">Welcome!</h2>
            <p className="text-muted-foreground">
              What should we call you? Your friends will see this name when you
              share plans with them.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                className="text-center text-lg h-14 bg-white border-border"
                maxLength={100}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
