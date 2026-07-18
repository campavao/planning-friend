"use client";

import {
  AddContactButton,
  PhoneNumberDisplay,
} from "@/components/add-contact-button";
import { AddToHomeScreenButton } from "@/components/add-to-homescreen-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { clearSWRCache, fetcher } from "@/lib/swr-config";
import { getWeekStartDay, setWeekStartDay } from "@/lib/utils";
import useSWR from "swr";
import { useSession } from "../useSession";
import {
  Bell,
  Calendar,
  Hand,
  Info,
  Loader2,
  LogOut,
  MapPin,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [homeRegion, setHomeRegion] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [saving, setSaving] = useState(false);
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

  const { isLoading: sessionLoading } = useSession();

  // These are edit-in-place forms, so disable focus revalidation — a
  // background refetch must not overwrite what the user is typing. The fields
  // are seeded once from the fetched values.
  const {
    data: settingsData,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR<{ settings?: UserSettings }>("/api/settings", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: nameData, mutate: mutateName } = useSWR<{ name?: string }>(
    "/api/users/name",
    fetcher,
    { revalidateOnFocus: false }
  );

  const loading = sessionLoading || (settingsLoading && !settingsData);

  useEffect(() => {
    setWeekStartDayValue(getWeekStartDay());
  }, []);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !settingsData) return;
    seededRef.current = true;
    setHomeRegion(settingsData.settings?.home_region || "");
    setHomeCountry(settingsData.settings?.home_country || "");
  }, [settingsData]);

  const nameSeededRef = useRef(false);
  useEffect(() => {
    if (nameSeededRef.current || !nameData) return;
    nameSeededRef.current = true;
    if (nameData.name) setUserName(nameData.name);
  }, [nameData]);

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
        mutateName();
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
        mutateSettings({ settings: data.settings }, { revalidate: false });
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
        <Card>
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
              <Label className="mb-1.5">
                Your Name
              </Label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                maxLength={100}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveName}
                disabled={savingName || !userName.trim()}
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
        </Card>

        {/* Home Location */}
        <Card>
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
              <Label className="mb-1.5">
                City / Region
              </Label>
              <Input
                value={homeRegion}
                onChange={(e) => setHomeRegion(e.target.value)}
                placeholder="e.g., Chicago, IL"
              />
            </div>
            <div>
              <Label className="mb-1.5">
                Country
              </Label>
              <Input
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                placeholder="e.g., United States"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
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
        </Card>

        {/* Calendar Preferences */}
        <Card>
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
              <Label className="mb-1.5">
                Week starts on
              </Label>
              <Select
                value={String(weekStartDayValue)}
                onValueChange={(v) => handleWeekStartChange(Number(v))}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_START_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Changes take effect immediately
              </p>
            </div>
          </div>
        </Card>

        {/* Push Notifications */}
        <Card>
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
        </Card>

        {/* Planner Sharing */}
        <Card>
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
        </Card>

        {/* About */}
        <Card>
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
        </Card>

        {/* Sign Out */}
        <Card className="border-red-200">
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
        </Card>
      </div>
    </main>
  );
}
