"use client";

import {
  AddContactButton,
  PhoneNumberDisplay,
} from "@/components/add-contact-button";
import { AddToHomeScreenButton } from "@/components/add-to-homescreen-button";
import { InitialsAvatar } from "@/components/initials-avatar";
import { ListGroup, ListRow } from "@/components/list-group";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { clearSWRCache, fetcher } from "@/lib/swr-config";
import {
  formatPhoneNumber,
  getWeekStartDay,
  setWeekStartDay,
} from "@/lib/utils";
import useSWR from "swr";
import { useSession } from "../useSession";
import { Loader2, LogOut } from "lucide-react";
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
  note_reminders_enabled?: boolean;
  note_reminder_delay_minutes?: number;
}

// Offsets from the scheduled time, phrased the way someone thinks about
// "when should I be asked how it went".
const NOTE_REMINDER_DELAY_OPTIONS = [
  { value: 60, label: "1 hour later" },
  { value: 120, label: "2 hours later" },
  { value: 240, label: "4 hours later" },
  { value: 720, label: "12 hours later" },
  { value: 1440, label: "The next day" },
];

export default function SettingsPage() {
  const [homeRegion, setHomeRegion] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [weekStartDayValue, setWeekStartDayValue] = useState(0);
  // Default on, matching the server's resolved defaults — a user who has never
  // saved settings still has reminders.
  const [noteRemindersEnabled, setNoteRemindersEnabled] = useState(true);
  const [noteReminderDelay, setNoteReminderDelay] = useState(120);
  const [noteReminderMessage, setNoteReminderMessage] = useState("");
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

  const { user, isLoading: sessionLoading } = useSession();

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
    if (typeof settingsData.settings?.note_reminders_enabled === "boolean") {
      setNoteRemindersEnabled(settingsData.settings.note_reminders_enabled);
    }
    if (typeof settingsData.settings?.note_reminder_delay_minutes === "number") {
      setNoteReminderDelay(settingsData.settings.note_reminder_delay_minutes);
    }
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

  // Saved on change rather than behind a button: it's a preference, not a
  // form. The POST carries only the reminder fields, so the location inputs
  // the user may be mid-edit are untouched.
  const saveNoteReminders = async (changes: {
    note_reminders_enabled?: boolean;
    note_reminder_delay_minutes?: number;
  }) => {
    setNoteReminderMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      mutateSettings({ settings: data.settings }, { revalidate: false });
      setNoteReminderMessage("Saved!");
      setTimeout(() => setNoteReminderMessage(""), 3000);
    } catch (error) {
      console.error("Failed to save note reminder settings:", error);
      setNoteReminderMessage("Failed to save");
    }
  };

  const handleToggleNoteReminders = (next: boolean) => {
    setNoteRemindersEnabled(next);
    saveNoteReminders({ note_reminders_enabled: next });
  };

  const handleNoteReminderDelayChange = (minutes: number) => {
    setNoteReminderDelay(minutes);
    saveNoteReminders({ note_reminder_delay_minutes: minutes });
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

  const savedName = nameData?.name ?? "";
  const nameDirty = userName.trim() !== "" && userName.trim() !== savedName;
  const savedRegion = settingsData?.settings?.home_region ?? "";
  const savedCountry = settingsData?.settings?.home_country ?? "";
  const locationDirty =
    homeRegion !== savedRegion || homeCountry !== savedCountry;
  const pushBlocked = permission === "denied";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-8 bg-[var(--background)]">
      <PageHeader title="Settings" />

      {/* One grouped list rather than a card per setting: each card's tinted
          header and icon tile cost more than the setting it introduced. */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-1 pb-6 space-y-7">
        {/* Who you are, the way an account page opens */}
        <ListGroup footer="Shown to friends when you share plans.">
          <div className="flex items-center gap-3.5 px-4 py-4">
            <InitialsAvatar
              name={savedName || "?"}
              className="size-14 text-lg"
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-tight truncate">
                {savedName || "Add your name"}
              </p>
              {user?.phoneNumber && (
                <p className="text-sm text-muted-foreground">
                  {formatPhoneNumber(user.phoneNumber)}
                </p>
              )}
            </div>
          </div>
          <FieldRow label="Name">
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nameDirty && handleSaveName()}
              placeholder="Your name"
              aria-label="Your name"
              maxLength={100}
              className={FIELD_INPUT}
            />
          </FieldRow>
        </ListGroup>
        <SaveLine
          visible={nameDirty || !!nameMessage}
          saving={savingName}
          message={nameMessage}
          onSave={handleSaveName}
        />

        <ListGroup
          label="Home location"
          footer="Places outside it are marked as Travel."
        >
          <FieldRow label="City">
            <input
              value={homeRegion}
              onChange={(e) => setHomeRegion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && locationDirty && handleSave()}
              placeholder="Chicago, IL"
              aria-label="City or region"
              className={FIELD_INPUT}
            />
          </FieldRow>
          <FieldRow label="Country">
            <input
              value={homeCountry}
              onChange={(e) => setHomeCountry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && locationDirty && handleSave()}
              placeholder="United States"
              aria-label="Country"
              className={FIELD_INPUT}
            />
          </FieldRow>
        </ListGroup>
        <SaveLine
          visible={locationDirty || !!message}
          saving={saving}
          message={message}
          onSave={handleSave}
        />

        <ListGroup label="Planner">
          <ListRow label="Week starts on">
            <Select
              value={String(weekStartDayValue)}
              onValueChange={(v) => handleWeekStartChange(Number(v))}
            >
              <SelectTrigger
                size="sm"
                aria-label="Week starts on"
                className={SELECT_TRIGGER}
              >
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
          </ListRow>
          <ListRow
            label="Share your planner"
            description="Invite friends from the planner"
            href="/dashboard/planner"
          />
        </ListGroup>

        <ListGroup
          label="Notifications"
          footer={
            noteReminderMessage ? (
              <span
                className={
                  noteReminderMessage.includes("Failed")
                    ? "text-destructive"
                    : "text-[var(--secondary-dark)]"
                }
              >
                {noteReminderMessage}
              </span>
            ) : undefined
          }
        >
          <ListRow
            label="Push notifications"
            description={
              !isSupported
                ? "Not supported in this browser"
                : pushBlocked
                  ? "Blocked — allow them in browser settings"
                  : pushError
                    ? <span className="text-destructive">{pushError}</span>
                    : "When a saved link finishes processing"
            }
          >
            {pushChecking || pushLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={isSubscribed}
                onCheckedChange={(next) => (next ? subscribe() : unsubscribe())}
                disabled={!isSupported || pushBlocked}
                aria-label="Push notifications"
              />
            )}
          </ListRow>
          {/* Post-event note reminders. Shown regardless of push support:
              the preference is stored server-side and the reminder is what
              the push would be delivering. */}
          <ListRow
            label="Ask how it went"
            description="A nudge to note how a planned item actually was"
          >
            <Switch
              checked={noteRemindersEnabled}
              onCheckedChange={handleToggleNoteReminders}
              aria-label="Ask how it went"
            />
          </ListRow>
          {noteRemindersEnabled && (
            <ListRow label="When to ask">
              <Select
                value={String(noteReminderDelay)}
                onValueChange={(v) => handleNoteReminderDelayChange(Number(v))}
              >
                <SelectTrigger size="sm" aria-label="When to ask" className={SELECT_TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_REMINDER_DELAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ListRow>
          )}
        </ListGroup>

        <ListGroup
          label="Planning Friend"
          footer={
            <>
              Text links to <PhoneNumberDisplay /> to save them. Version 1.0
            </>
          }
        >
          <AddContactButton variant="row" />
          <AddToHomeScreenButton variant="row" />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={<LogOut className="size-[18px] text-destructive" />}
            label="Sign out"
            destructive
            onClick={handleLogout}
          />
        </ListGroup>
      </div>
    </main>
  );
}

const FIELD_INPUT =
  "min-w-0 flex-1 bg-transparent text-right text-[15px] placeholder:text-muted-foreground focus:outline-none";

const SELECT_TRIGGER =
  "h-auto border-none bg-transparent px-0 py-0 text-[15px] text-muted-foreground shadow-none focus:ring-0";

/** A label on the left and its value, editable in place, on the right. */
function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-[52px] items-center gap-3 px-4 py-3 focus-within:bg-[var(--background)]">
      <span className="shrink-0 text-[15px] font-medium">{label}</span>
      {children}
    </label>
  );
}

/**
 * The Save for a group of fields, shown only once something in it changed —
 * a permanent button under every field read as a form to fill in, when most
 * visits change nothing.
 */
function SaveLine({
  visible,
  saving,
  message,
  onSave,
}: {
  visible: boolean;
  saving: boolean;
  message: string;
  onSave: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="-mt-5 flex items-center justify-end gap-3 px-1">
      {message && (
        <span
          className={`text-sm font-medium ${
            message.includes("Failed")
              ? "text-destructive"
              : "text-[var(--secondary-dark)]"
          }`}
        >
          {message}
        </span>
      )}
      {!message && (
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
}
