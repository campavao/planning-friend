"use client";

import {
  AddContactButton,
  PhoneNumberDisplay,
} from "@/components/add-contact-button";
import { AddToHomeScreenButton } from "@/components/add-to-homescreen-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { clearSWRCache } from "@/lib/swr-config";
import { getWeekStartDay, setWeekStartDay } from "@/lib/utils";
import {
  Bell,
  Calendar,
  ChevronDown,
  Hand,
  Info,
  Loader2,
  LogOut,
  MapPin,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const WEEK_START_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface UserSettings {
  home_region?: string;
  home_country?: string;
}

export default function SettingsPage() {
  const [, setSettings] = useState<UserSettings>({});
  const [homeRegion, setHomeRegion] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [weekStartDayValue, setWeekStartDayValue] = useState(0);
  const router = useRouter();
  const {
    permission,
    isSubscribed,
    isLoading: pushLoading,
    isChecking: pushChecking,
    error: pushError,
    subscribe,
    unsubscribe,
    isSupported,
  } = usePushNotifications();

  useEffect(() => {
    setWeekStartDayValue(getWeekStartDay());
  }, []);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsRes, nameRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/users/name"),
        ]);

        if (settingsRes.status === 401 || nameRes.status === 401) {
          router.push("/");
          return;
        }

        const settingsData = await settingsRes.json();
        if (settingsData.settings) {
          setSettings(settingsData.settings);
          setHomeRegion(settingsData.settings.home_region || "");
          setHomeCountry(settingsData.settings.home_country || "");
        }

        const nameData = await nameRes.json();
        if (nameData.name) {
          setUserName(nameData.name);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [router]);

  const handleWeekStartChange = (value: number) => {
    setWeekStartDayValue(value);
    setWeekStartDay(value);
  };

  const handleSaveName = async () => {
    if (!userName.trim()) return;

    setSavingName(true);
    setNameMessage("");

    try {
      const res = await fetch("/api/users/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userName.trim() }),
      });

      if (res.ok) {
        setNameMessage("Saved!");
        setTimeout(() => setNameMessage(""), 3000);
      } else {
        const data = await res.json();
        setNameMessage(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save name:", error);
      setNameMessage("Failed to save");
    } finally {
      setSavingName(false);
    }
  };

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
        setMessage("Saved!");
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
    clearSWRCache();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
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
      <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-4 py-5 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="heading-1 text-white">
            Settings
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Customize your experience
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Profile / Name */}
        <div className="card-elevated">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                Your Profile
              </h2>
              <p className="text-xs text-muted-foreground">
                Shown to friends when you share plans
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Your Name
              </label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="input-modern"
                maxLength={100}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveName}
                disabled={savingName || !userName.trim()}
                className="btn-primary"
              >
                {savingName ? "Saving..." : "Save Name"}
              </Button>
              {nameMessage && (
                <span
                  className={`text-sm font-medium ${
                    nameMessage.includes("Failed")
                      ? "text-destructive"
                      : "text-[var(--primary)]"
                  }`}
                >
                  {nameMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Home Location */}
        <div className="card-elevated">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--secondary)]/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[var(--secondary)]" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                Home Location
              </h2>
              <p className="text-xs text-muted-foreground">
                Places outside this will be marked as Travel
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                City / Region
              </label>
              <Input
                value={homeRegion}
                onChange={(e) => setHomeRegion(e.target.value)}
                placeholder="e.g., Chicago, IL"
                className="input-modern"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Country
              </label>
              <Input
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                placeholder="e.g., United States"
                className="input-modern"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? "Saving..." : "Save Location"}
              </Button>
              {message && (
                <span className="text-sm text-[var(--primary)] font-medium">
                  {message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Preferences */}
        <div className="card-elevated">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                Calendar Preferences
              </h2>
              <p className="text-xs text-muted-foreground">
                Customize your weekly planner display
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Week starts on
              </label>
              <div className="relative w-full max-w-xs">
                <select
                  value={weekStartDayValue}
                  onChange={(e) =>
                    handleWeekStartChange(Number(e.target.value))
                  }
                  className="input-modern w-full pr-10 appearance-none cursor-pointer"
                >
                  {WEEK_START_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Changes take effect immediately
              </p>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="card-elevated">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                Notifications
              </h2>
              <p className="text-xs text-muted-foreground">
                Get notified when content finishes processing
              </p>
            </div>
          </div>

          <div className="p-4">
            {!isSupported ? (
              <p className="text-sm text-muted-foreground">
                Push notifications are not supported in this browser.
              </p>
            ) : pushChecking ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </div>
            ) : (
              <div className="space-y-3">
                {permission === "denied" ? (
                  <p className="text-sm text-amber-600">
                    Notifications are blocked. Enable them in browser settings.
                  </p>
                ) : isSubscribed ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-muted-foreground">
                        Enabled
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={unsubscribe}
                      disabled={pushLoading}
                      className="rounded-lg border-[var(--border)]"
                    >
                      {pushLoading ? "..." : "Turn Off"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={subscribe}
                    disabled={pushLoading}
                    className="btn-primary"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    {pushLoading ? "Enabling..." : "Enable Notifications"}
                  </Button>
                )}
                {pushError && (
                  <p className="text-sm text-destructive">
                    {pushError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Planner Sharing */}
        <div className="card-elevated">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                Planner Sharing
              </h2>
              <p className="text-xs text-muted-foreground">
                Share your weekly planner with friends
              </p>
            </div>
          </div>

          <div className="p-4">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/planner")}
              className="rounded-xl border-[var(--border)] hover:bg-[var(--muted)]"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Go to Planner
            </Button>
          </div>
        </div>

        {/* About */}
        <div className="card-elevated">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background-alt)] rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
              <Info className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                About Planning Friend
              </h2>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Your personal assistant for collecting and organizing ideas from
              social media. Text links to save meals, events, date ideas, and
              more!
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <AddContactButton variant="button" />
              <AddToHomeScreenButton variant="button" />
            </div>
            <p className="text-sm text-muted-foreground">
              Text links to <PhoneNumberDisplay /> to save content
            </p>

            <p className="text-xs text-muted-foreground">
              Version 1.0
            </p>
          </div>
        </div>

        {/* Sign Out */}
        <div className="card-elevated border-red-200">
          <div className="p-4 border-b border-red-200 bg-red-50 rounded-t-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Hand className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-destructive">
                Sign Out
              </h2>
              <p className="text-xs text-muted-foreground">
                Sign out of this device
              </p>
            </div>
          </div>

          <div className="p-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="rounded-xl border-red-200 text-destructive hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
