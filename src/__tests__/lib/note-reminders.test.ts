/**
 * Tests for the "how was it?" reminder rule.
 *
 * These assert the decision — given a time, a delay, an existing note and a
 * prior send, does this occasion earn a reminder right now — rather than the
 * shape of any query or payload. A test that restates the implementation
 * passes while the feature is broken.
 */

import {
  DEFAULT_NOTE_REMINDER_DELAY_MINUTES,
  MAX_NOTE_REMINDER_DELAY_MINUTES,
  NOTE_REMINDER_WINDOW_MINUTES,
  clampDelayMinutes,
  noteReminderDueAt,
  noteReminderQueryWindow,
  resolveNoteReminderSettings,
  shouldSendNoteReminder,
  type NoteReminderCandidate,
  type NoteReminderSettings,
} from "@/lib/note-reminders";
import { MAX_UTC_OFFSET_MINUTES } from "@/lib/timezone";

const MINUTE = 60 * 1000;

// Dinner at 19:00 with the default 2h delay becomes due at 21:00.
const PLANNED = "2026-03-10T19:00:00.000Z";
const DUE_MS = Date.parse("2026-03-10T21:00:00.000Z");

const ON: NoteReminderSettings = {
  enabled: true,
  delayMinutes: 120,
  timeZone: "UTC",
};

function candidate(
  overrides: Partial<NoteReminderCandidate> = {}
): NoteReminderCandidate {
  return {
    planItemId: "item-1",
    contentId: "content-1",
    plannedDate: PLANNED,
    noteReminderSentAt: null,
    hasNoteSincePlanned: false,
    ...overrides,
  };
}

describe("shouldSendNoteReminder — the time boundary", () => {
  const cases: {
    name: string;
    nowMs: number;
    send: boolean;
    reason?: string;
  }[] = [
    {
      name: "before the scheduled time",
      nowMs: DUE_MS - 121 * MINUTE,
      send: false,
      reason: "not_due_yet",
    },
    {
      name: "one minute short of the delay",
      nowMs: DUE_MS - MINUTE,
      send: false,
      reason: "not_due_yet",
    },
    {
      name: "one millisecond short of the delay",
      nowMs: DUE_MS - 1,
      send: false,
      reason: "not_due_yet",
    },
    { name: "exactly at the delay", nowMs: DUE_MS, send: true },
    { name: "one millisecond after", nowMs: DUE_MS + 1, send: true },
    {
      name: "a cron tick later",
      nowMs: DUE_MS + 15 * MINUTE,
      send: true,
    },
    {
      name: "at the far edge of the catch-up window",
      nowMs: DUE_MS + NOTE_REMINDER_WINDOW_MINUTES * MINUTE,
      send: true,
    },
    {
      name: "one millisecond past the catch-up window",
      nowMs: DUE_MS + NOTE_REMINDER_WINDOW_MINUTES * MINUTE + 1,
      send: false,
      reason: "outside_window",
    },
    {
      name: "a week stale (cron was down)",
      nowMs: DUE_MS + 7 * 24 * 60 * MINUTE,
      send: false,
      reason: "outside_window",
    },
  ];

  it.each(cases)("$name", ({ nowMs, send, reason }) => {
    const decision = shouldSendNoteReminder(candidate(), ON, new Date(nowMs));
    expect(decision.send).toBe(send);
    if (!decision.send) expect(decision.reason).toBe(reason);
  });
});

describe("shouldSendNoteReminder — the delay is the user's", () => {
  it("does not fire two hours in when the user asked for the next day", () => {
    const nextDay: NoteReminderSettings = {
      enabled: true,
      delayMinutes: 1440,
      timeZone: "UTC",
    };
    const decision = shouldSendNoteReminder(
      candidate(),
      nextDay,
      new Date(DUE_MS)
    );
    expect(decision).toMatchObject({ send: false, reason: "not_due_yet" });
  });

  it("fires once the longer delay has passed", () => {
    const nextDay: NoteReminderSettings = {
      enabled: true,
      delayMinutes: 1440,
      timeZone: "UTC",
    };
    const dayAfterPlanned = Date.parse(PLANNED) + 1440 * MINUTE;
    expect(
      shouldSendNoteReminder(candidate(), nextDay, new Date(dayAfterPlanned))
        .send
    ).toBe(true);
  });
});

describe("shouldSendNoteReminder — the idempotency guard", () => {
  it("does not send again once a reminder has been stamped", () => {
    const decision = shouldSendNoteReminder(
      candidate({ noteReminderSentAt: "2026-03-10T21:00:00.000Z" }),
      ON,
      new Date(DUE_MS + MINUTE)
    );
    expect(decision).toMatchObject({ send: false, reason: "already_sent" });
  });

  it("stays silent for every later run in the window", () => {
    const sent = candidate({ noteReminderSentAt: "2026-03-10T21:00:00.000Z" });
    for (let tick = 0; tick <= NOTE_REMINDER_WINDOW_MINUTES; tick += 15) {
      expect(
        shouldSendNoteReminder(sent, ON, new Date(DUE_MS + tick * MINUTE)).send
      ).toBe(false);
    }
  });
});

describe("shouldSendNoteReminder — a note was already written", () => {
  it("does not nudge someone who already wrote about this occasion", () => {
    const decision = shouldSendNoteReminder(
      candidate({ hasNoteSincePlanned: true }),
      ON,
      new Date(DUE_MS + MINUTE)
    );
    expect(decision).toMatchObject({
      send: false,
      reason: "note_already_written",
    });
  });

  it("still nudges when the only notes predate this occasion", () => {
    // hasNoteSincePlanned is scoped to notes dated on or after the occasion,
    // so a review of last month's visit must not silence this one.
    expect(
      shouldSendNoteReminder(
        candidate({ hasNoteSincePlanned: false }),
        ON,
        new Date(DUE_MS + MINUTE)
      ).send
    ).toBe(true);
  });
});

describe("shouldSendNoteReminder — never sends at all", () => {
  it("respects the off switch", () => {
    const decision = shouldSendNoteReminder(
      candidate(),
      { enabled: false, delayMinutes: 120, timeZone: "UTC" },
      new Date(DUE_MS + MINUTE)
    );
    expect(decision).toMatchObject({
      send: false,
      reason: "reminders_disabled",
    });
  });

  it("reports the off switch ahead of every other reason", () => {
    const decision = shouldSendNoteReminder(
      candidate({
        noteReminderSentAt: "2026-03-10T21:00:00.000Z",
        hasNoteSincePlanned: true,
      }),
      { enabled: false, delayMinutes: 120, timeZone: "UTC" },
      new Date(DUE_MS + MINUTE)
    );
    expect(decision).toMatchObject({
      send: false,
      reason: "reminders_disabled",
    });
  });

  it("skips quick notes — there is no saved item to review", () => {
    const decision = shouldSendNoteReminder(
      candidate({ contentId: null }),
      ON,
      new Date(DUE_MS + MINUTE)
    );
    expect(decision).toMatchObject({ send: false, reason: "no_content" });
  });

  it("skips an unparseable planned date instead of throwing", () => {
    const decision = shouldSendNoteReminder(
      candidate({ plannedDate: "not a date" }),
      ON,
      new Date(DUE_MS + MINUTE)
    );
    expect(decision).toMatchObject({
      send: false,
      reason: "invalid_planned_date",
    });
  });
});

describe("noteReminderDueAt", () => {
  it("adds the delay to the scheduled time", () => {
    expect(noteReminderDueAt(PLANNED, 120)?.toISOString()).toBe(
      "2026-03-10T21:00:00.000Z"
    );
  });

  it("returns null for an unparseable date", () => {
    expect(noteReminderDueAt("", 120)).toBeNull();
  });
});

describe("resolveNoteReminderSettings", () => {
  it("defaults to on for a user with no settings row", () => {
    expect(resolveNoteReminderSettings(null)).toEqual({
      enabled: true,
      delayMinutes: DEFAULT_NOTE_REMINDER_DELAY_MINUTES,
      timeZone: "UTC",
    });
  });

  it("defaults to on for a row read before the migration ran", () => {
    // The columns are absent entirely, not false.
    expect(resolveNoteReminderSettings({})).toEqual({
      enabled: true,
      delayMinutes: DEFAULT_NOTE_REMINDER_DELAY_MINUTES,
      timeZone: "UTC",
    });
  });

  it("honours an explicit opt-out", () => {
    expect(
      resolveNoteReminderSettings({ note_reminders_enabled: false }).enabled
    ).toBe(false);
  });

  it("honours a custom delay", () => {
    expect(
      resolveNoteReminderSettings({ note_reminder_delay_minutes: 45 })
        .delayMinutes
    ).toBe(45);
  });

  it("treats a NULL column as unset rather than off", () => {
    expect(
      resolveNoteReminderSettings({
        note_reminders_enabled: null,
        note_reminder_delay_minutes: null,
      })
    ).toEqual({
      enabled: true,
      delayMinutes: DEFAULT_NOTE_REMINDER_DELAY_MINUTES,
      timeZone: "UTC",
    });
  });
});

describe("clampDelayMinutes", () => {
  it.each([
    [0, DEFAULT_NOTE_REMINDER_DELAY_MINUTES],
    [-30, DEFAULT_NOTE_REMINDER_DELAY_MINUTES],
    [MAX_NOTE_REMINDER_DELAY_MINUTES + 1, DEFAULT_NOTE_REMINDER_DELAY_MINUTES],
    [Number.NaN, DEFAULT_NOTE_REMINDER_DELAY_MINUTES],
    [1, 1],
    [MAX_NOTE_REMINDER_DELAY_MINUTES, MAX_NOTE_REMINDER_DELAY_MINUTES],
    [119.6, 120],
  ])("maps %p to %p", (input, expected) => {
    expect(clampDelayMinutes(input)).toBe(expected);
  });

  it("falls back for values that are not numbers at all", () => {
    expect(clampDelayMinutes("120")).toBe(DEFAULT_NOTE_REMINDER_DELAY_MINUTES);
    expect(clampDelayMinutes(undefined)).toBe(
      DEFAULT_NOTE_REMINDER_DELAY_MINUTES
    );
  });
});

describe("noteReminderQueryWindow", () => {
  const now = new Date("2026-03-11T09:00:00.000Z");

  it("reaches past now by the widest offset there is", () => {
    // The stored value is a wall clock, not an instant: a 7pm dinner in
    // Auckland reads as a time still in the future from UTC's point of view
    // hours after it has finished.
    const { toIso } = noteReminderQueryWindow(now);
    expect((Date.parse(toIso) - now.getTime()) / MINUTE).toBe(
      MAX_UTC_OFFSET_MINUTES
    );
  });

  it("reaches back far enough for the longest delay a user can pick", () => {
    // Otherwise an occasion with a week-long delay falls out of the query
    // before it ever becomes due.
    const { fromIso } = noteReminderQueryWindow(now);
    const spanMinutes = (now.getTime() - Date.parse(fromIso)) / MINUTE;
    expect(spanMinutes).toBe(
      NOTE_REMINDER_WINDOW_MINUTES +
        MAX_NOTE_REMINDER_DELAY_MINUTES +
        MAX_UTC_OFFSET_MINUTES
    );
  });

  it("still contains an occasion at the very edge of eligibility", () => {
    const maxSettings: NoteReminderSettings = {
      enabled: true,
      delayMinutes: MAX_NOTE_REMINDER_DELAY_MINUTES,
      timeZone: "UTC",
    };
    const { fromIso, toIso } = noteReminderQueryWindow(now);
    const edge = candidate({ plannedDate: fromIso });

    expect(fromIso <= edge.plannedDate && edge.plannedDate <= toIso).toBe(true);
    // Still inside the 24h grace once the max delay has elapsed.
    const justInside = candidate({
      plannedDate: new Date(
        now.getTime() -
          (NOTE_REMINDER_WINDOW_MINUTES + MAX_NOTE_REMINDER_DELAY_MINUTES) *
            MINUTE
      ).toISOString(),
    });
    expect(shouldSendNoteReminder(justInside, maxSettings, now).send).toBe(true);
  });
});

/**
 * The bug this fixes, stated as a test: reminders for a Chicago dinner arrived
 * before the meal, earlier by exactly the diner's offset from UTC.
 */
describe("reminders land after the meal, not before it", () => {
  // A 7pm dinner on a Tuesday in August, stored the way the planner stores it.
  const DINNER = "2026-08-25T19:00:00.000Z";
  const CHICAGO = "America/Chicago";
  // 7pm Chicago in August (CDT, UTC-5) is midnight UTC the next day.
  const DINNER_REALLY_AT = Date.parse("2026-08-26T00:00:00.000Z");

  const chicago: NoteReminderSettings = {
    enabled: true,
    delayMinutes: 60,
    timeZone: CHICAGO,
  };

  it("is not due while the diner is still eating", () => {
    // 7:30pm Chicago — half an hour into dinner. The old code had this one
    // already sent, two and a half hours earlier.
    const during = new Date(DINNER_REALLY_AT + 30 * MINUTE);
    const decision = shouldSendNoteReminder(
      candidate({ plannedDate: DINNER }),
      chicago,
      during
    );
    expect(decision.send).toBe(false);
    expect(decision.send === false && decision.reason).toBe("not_due_yet");
  });

  it("comes due exactly one hour after the meal", () => {
    const decision = shouldSendNoteReminder(
      candidate({ plannedDate: DINNER }),
      chicago,
      new Date(DINNER_REALLY_AT + 60 * MINUTE)
    );
    expect(decision.send).toBe(true);
    expect(decision.dueAt?.getTime()).toBe(DINNER_REALLY_AT + 60 * MINUTE);
  });

  it("would have fired three hours early on the old reading", () => {
    // The regression guard: treating the stored string as an instant puts the
    // due time five hours before where it belongs.
    const asIfUtc = noteReminderDueAt(DINNER, 60, "UTC")!;
    const correct = noteReminderDueAt(DINNER, 60, CHICAGO)!;
    expect((correct.getTime() - asIfUtc.getTime()) / MINUTE).toBe(5 * 60);
    // And the wrong one lands before the meal had even started.
    expect(asIfUtc.getTime()).toBeLessThan(DINNER_REALLY_AT);
  });

  it("works east of UTC too, where the error ran the other way", () => {
    const auckland: NoteReminderSettings = {
      enabled: true,
      delayMinutes: 60,
      timeZone: "Pacific/Auckland",
    };
    // 7pm Auckland in August (NZST, UTC+12) is 07:00Z.
    const realDinner = Date.parse("2026-08-25T07:00:00.000Z");
    expect(
      shouldSendNoteReminder(
        candidate({ plannedDate: DINNER }),
        auckland,
        new Date(realDinner + 60 * MINUTE)
      ).send
    ).toBe(true);
  });

  it("falls back to the old behaviour when the zone is unknown", () => {
    const noZone = resolveNoteReminderSettings({
      note_reminder_delay_minutes: 60,
    });
    expect(noZone.timeZone).toBe("UTC");
    expect(noteReminderDueAt(DINNER, 60, noZone.timeZone)?.toISOString()).toBe(
      "2026-08-25T20:00:00.000Z"
    );
  });
});
