"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AddContactButton,
  PhoneNumberDisplay,
} from "@/components/add-contact-button";
import { AddToHomeScreenButton } from "@/components/add-to-homescreen-button";

interface UserSettings {
  home_region?: string;
  home_country?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [homeRegion, setHomeRegion] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
          setHomeRegion(data.settings.home_region || "");
          setHomeCountry(data.settings.home_country || "");
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_region: homeRegion,
          home_country: homeCountry,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setMessage("Saved! ✨");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-shimmer w-16 h-16 rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-paper">
      {/* Scrapbook Header */}
      <div className="pt-6 pb-4 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative inline-block">
            <h1 className="font-handwritten text-4xl md:text-5xl text-foreground transform -rotate-1">
              Settings
            </h1>
            <div className="absolute -bottom-1 left-0 right-0 h-2 bg-washi-lavender/60 transform rotate-0.5 -z-10" />
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            ⚙️ Customize your experience
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Home Location */}
        <div className="scrapbook-card p-5 relative">
          {/* Tape decoration */}
          <div className="absolute -top-2 left-6 w-14 h-5 bg-washi-mint/80 transform -rotate-2" />

          <div className="flex items-center gap-3 mb-4 pt-2">
            <span className="text-2xl">🏠</span>
            <div>
              <h2 className="font-handwritten text-2xl">Home Location</h2>
              <p className="text-sm text-muted-foreground">
                Places outside your home region will be marked as Travel
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                City / Region
              </label>
              <Input
                value={homeRegion}
                onChange={(e) => setHomeRegion(e.target.value)}
                placeholder="e.g., Chicago, IL or San Francisco Bay Area"
                className="bg-white border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Input
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                placeholder="e.g., United States"
                className="bg-white border-border"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save Location"}
              </Button>
              {message && (
                <span className="text-sm text-primary font-medium">
                  {message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Planner Sharing */}
        <div className="scrapbook-card p-5 relative">
          <div className="absolute -top-2 right-8 w-12 h-5 bg-washi-pink/80 transform rotate-1" />

          <div className="flex items-center gap-3 mb-4 pt-2">
            <span className="text-2xl">🤝</span>
            <div>
              <h2 className="font-handwritten text-2xl">Planner Sharing</h2>
              <p className="text-sm text-muted-foreground">
                Share your weekly planner with friends or family using share
                codes
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/planner")}
            className="hover:bg-washi-blue/20"
          >
            📅 Go to Planner →
          </Button>
        </div>

        {/* About */}
        <div className="scrapbook-card p-5 relative">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-5 bg-washi-yellow/80 transform -rotate-1" />

          <div className="flex items-center gap-3 mb-4 pt-2">
            <span className="text-2xl">📒</span>
            <div>
              <h2 className="font-handwritten text-2xl">
                About Planning Friend
              </h2>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Planning Friend is your personal assistant for collecting and
            organizing ideas from social media. Text links to save meals,
            events, date ideas, and more!
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <AddContactButton variant="button" />
            <AddToHomeScreenButton variant="button" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Text links to <PhoneNumberDisplay /> to save content
          </p>

          <p className="text-xs text-muted-foreground">
            Version 1.0 • Made with 💕
          </p>
        </div>

        {/* Sign Out */}
        <div className="scrapbook-card p-5 relative border-destructive/20">
          <div className="absolute -top-2 right-6 w-10 h-5 bg-washi-coral/80 transform rotate-2" />

          <div className="flex items-center gap-3 mb-4 pt-2">
            <span className="text-2xl">👋</span>
            <div>
              <h2 className="font-handwritten text-2xl">Sign Out</h2>
              <p className="text-sm text-muted-foreground">
                Sign out of this device
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </main>
  );
}
