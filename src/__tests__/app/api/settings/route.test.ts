/**
 * The settings round-trip: what a client POSTs has to survive the route and
 * come back out of GET.
 *
 * The route previously destructured only `home_region` and `home_country`, so
 * any new setting was accepted with a 200 and silently discarded. The store
 * below is a faithful stand-in for the row (it merges exactly the keys it is
 * handed), so what these tests exercise is the route's own whitelist.
 */

import { NextRequest } from "next/server";

const mockRows = new Map<string, Record<string, unknown>>();
const mockUpsertCalls: Record<string, unknown>[] = [];

jest.mock("@/lib/auth", () => ({
  requireSession: jest.fn(async () => ({
    session: { userId: "user-1", phoneNumber: "+15550001111", exp: Date.now() + 1000 },
    errorResponse: null,
  })),
}));

jest.mock("@/lib/supabase", () => ({
  getUserSettings: jest.fn(async (userId: string) => mockRows.get(userId) ?? null),
  upsertUserSettings: jest.fn(
    async (userId: string, settings: Record<string, unknown>) => {
      mockUpsertCalls.push(settings);
      const next = {
        id: "settings-1",
        user_id: userId,
        created_at: "2026-01-01T00:00:00.000Z",
        ...(mockRows.get(userId) ?? {}),
        ...settings,
      };
      mockRows.set(userId, next);
      return next;
    }
  ),
}));

import { GET, POST } from "@/app/api/settings/route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function get() {
  return GET(new NextRequest("http://localhost/api/settings"));
}

beforeEach(() => {
  mockRows.clear();
  mockUpsertCalls.length = 0;
});

describe("POST /api/settings", () => {
  it("persists the note-reminder toggle", async () => {
    const res = await post({ note_reminders_enabled: false });
    expect(res.status).toBe(200);

    // The exact failure mode this guards: a 200 whose payload never reached
    // the database.
    expect(mockUpsertCalls).toEqual([{ note_reminders_enabled: false }]);
    expect(mockRows.get("user-1")).toMatchObject({
      note_reminders_enabled: false,
    });
  });

  it("persists the reminder delay", async () => {
    await post({ note_reminder_delay_minutes: 240 });
    expect(mockUpsertCalls).toEqual([{ note_reminder_delay_minutes: 240 }]);
  });

  it("still persists the location fields", async () => {
    await post({ home_region: "Chicago, IL", home_country: "United States" });
    expect(mockUpsertCalls).toEqual([
      { home_region: "Chicago, IL", home_country: "United States" },
    ]);
  });

  it("leaves untouched settings alone on a partial save", async () => {
    await post({ note_reminders_enabled: false });
    await post({ home_region: "Chicago, IL" });

    // Saving the location must not resurrect the reminder the user turned off.
    expect(mockUpsertCalls[1]).toEqual({ home_region: "Chicago, IL" });
    expect(mockRows.get("user-1")).toMatchObject({
      home_region: "Chicago, IL",
      note_reminders_enabled: false,
    });
  });

  it("never writes a field the caller made up", async () => {
    await post({ home_region: "Chicago, IL", user_id: "someone-else" });
    expect(mockUpsertCalls).toEqual([{ home_region: "Chicago, IL" }]);
  });

  it("rejects an out-of-range delay instead of storing it", async () => {
    const res = await post({ note_reminder_delay_minutes: 0 });
    expect(res.status).toBe(400);
    expect(mockUpsertCalls).toHaveLength(0);
  });

  it("rejects a non-boolean toggle", async () => {
    const res = await post({ note_reminders_enabled: "yes" });
    expect(res.status).toBe(400);
    expect(mockUpsertCalls).toHaveLength(0);
  });
});

describe("GET /api/settings", () => {
  it("reports the saved toggle back", async () => {
    await post({ note_reminders_enabled: false });

    const body = await (await get()).json();
    expect(body.settings.note_reminders_enabled).toBe(false);
  });

  it("reports reminders on for a user with no settings row", async () => {
    const body = await (await get()).json();
    expect(body.settings).toMatchObject({
      note_reminders_enabled: true,
      note_reminder_delay_minutes: 120,
    });
  });

  it("reports the defaults for a row saved before the migration ran", async () => {
    // A pre-migration row has the location columns and nothing else.
    mockRows.set("user-1", {
      id: "settings-1",
      user_id: "user-1",
      home_region: "Chicago, IL",
      created_at: "2026-01-01T00:00:00.000Z",
    });

    const body = await (await get()).json();
    expect(body.settings).toMatchObject({
      home_region: "Chicago, IL",
      note_reminders_enabled: true,
      note_reminder_delay_minutes: 120,
    });
  });

  it("round-trips a custom delay", async () => {
    await post({ note_reminder_delay_minutes: 1440 });

    const body = await (await get()).json();
    expect(body.settings.note_reminder_delay_minutes).toBe(1440);
  });
});
