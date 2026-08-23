import {
  FALLBACK_TIME_ZONE,
  MAX_UTC_OFFSET_MINUTES,
  isValidTimeZone,
  resolveTimeZone,
  wallClockToInstant,
} from "@/lib/timezone";

describe("isValidTimeZone", () => {
  it("accepts IANA names this runtime knows", () => {
    for (const zone of ["UTC", "America/Chicago", "Europe/London", "Pacific/Auckland"]) {
      expect(isValidTimeZone(zone)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["", "   ", "Mars/Olympus", "GMT+5:30 ", null, undefined, 5, {}]) {
      expect(isValidTimeZone(value)).toBe(false);
    }
  });
});

describe("resolveTimeZone", () => {
  it("keeps a real zone and falls back for the rest", () => {
    expect(resolveTimeZone("America/Chicago")).toBe("America/Chicago");
    expect(resolveTimeZone(null)).toBe(FALLBACK_TIME_ZONE);
    expect(resolveTimeZone("Mars/Olympus")).toBe(FALLBACK_TIME_ZONE);
  });
});

describe("wallClockToInstant", () => {
  it("reads a 7pm dinner as 7pm where the diner is", () => {
    // Stored as 19:00Z, meaning "7pm local". In Chicago in August that is
    // CDT (UTC-5), so the real moment is midnight UTC the next day.
    const instant = wallClockToInstant(
      "2026-08-25T19:00:00.000Z",
      "America/Chicago"
    );
    expect(instant?.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("follows daylight saving rather than assuming a fixed offset", () => {
    // Same wall clock in January is CST (UTC-6).
    const winter = wallClockToInstant(
      "2026-01-25T19:00:00.000Z",
      "America/Chicago"
    );
    expect(winter?.toISOString()).toBe("2026-01-26T01:00:00.000Z");
  });

  it("handles a zone east of UTC", () => {
    // Auckland in August is NZST (UTC+12): 7pm there is 07:00Z the same day.
    const instant = wallClockToInstant(
      "2026-08-25T19:00:00.000Z",
      "Pacific/Auckland"
    );
    expect(instant?.toISOString()).toBe("2026-08-25T07:00:00.000Z");
  });

  it("handles a half-hour offset", () => {
    // Kolkata is UTC+5:30 year round.
    const instant = wallClockToInstant(
      "2026-08-25T19:00:00.000Z",
      "Asia/Kolkata"
    );
    expect(instant?.toISOString()).toBe("2026-08-25T13:30:00.000Z");
  });

  it("is the identity for UTC and for an unknown zone", () => {
    const iso = "2026-08-25T19:00:00.000Z";
    expect(wallClockToInstant(iso, "UTC")?.toISOString()).toBe(iso);
    expect(wallClockToInstant(iso, "Mars/Olympus")?.toISOString()).toBe(iso);
  });

  it("returns null for a date it cannot read", () => {
    expect(wallClockToInstant("not a date", "America/Chicago")).toBeNull();
  });

  it("never moves a time further than the widest real offset", () => {
    const iso = "2026-08-25T19:00:00.000Z";
    for (const zone of ["Pacific/Kiritimati", "Pacific/Midway", "Asia/Kolkata"]) {
      const shift = Math.abs(
        (wallClockToInstant(iso, zone)!.getTime() - Date.parse(iso)) / 60000
      );
      expect(shift).toBeLessThanOrEqual(MAX_UTC_OFFSET_MINUTES);
    }
  });
});
