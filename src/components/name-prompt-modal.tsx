"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open>
      {/* Forced prompt: no close button, and outside/escape dismissal is disabled */}
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md p-0 overflow-hidden"
      >
        {/* Gradient header accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)]" />

        <div className="p-6 pt-8">
          <DialogHeader className="text-center sm:text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
              <span className="text-3xl" role="img" aria-label="wave">
                👋
              </span>
            </div>
            <DialogTitle className="heading-1">Welcome!</DialogTitle>
            <DialogDescription>
              What should we call you? Your friends will see this name when you
              share plans with them.
            </DialogDescription>
          </DialogHeader>

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
                className="text-center text-lg h-14"
                maxLength={100}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
