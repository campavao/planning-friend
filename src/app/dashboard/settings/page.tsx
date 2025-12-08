"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        setMessage("Settings saved!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            ← Back
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Home Location */}
        <Card className="glass border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              Home Location
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Set your home location to help categorize travel content. Places
              outside your home region will be marked as Travel.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                City / Region
              </label>
              <Input
                value={homeRegion}
                onChange={(e) => setHomeRegion(e.target.value)}
                placeholder="e.g., Chicago, IL or San Francisco Bay Area"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Input
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                placeholder="e.g., United States"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Location"}
              </Button>
              {message && (
                <span className="text-sm text-primary">{message}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="glass border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">👤</span>
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your account is linked to your phone number. To log out, clear
              your browser cookies or use the logout button on the dashboard.
            </p>
          </CardContent>
        </Card>

        {/* Sharing Info */}
        <Card className="glass border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🤝</span>
              Planner Sharing
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Share your weekly planner with others using share codes. Generate
              a code from the planner page and share it with friends or family.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/dashboard/planner")}>
              Go to Planner →
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

