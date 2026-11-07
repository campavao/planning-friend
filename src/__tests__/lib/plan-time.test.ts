import {
  formatTimeLabel,
  plannedDateFor,
  shiftWeeks,
  shortDayLabel,
  weekDays,
} from "@/lib/plan-time";

describe("plannedDateFor", () => {
  it("keeps the chosen day and time in the UTC parts", () => {
    expect(plannedDateFor("2026-11-08", "19:00")).toBe(
      "2026-11-08T19:00:00.000Z"
    );
    expect(plannedDateFor("2026-11-08", "09:30")).toBe(
      "2026-11-08T09:30:00.000Z"
    );
  });

  it("never rolls an evening time onto the next ISO day", () => {
    expect(plannedDateFor("2026-12-31", "23:30")?.slice(0, 10)).toBe(
      "2026-12-31"
    );
  });

  it("rejects malformed input", () => {
    expect(plannedDateFor("nope", "19:00")).toBeNull();
    expect(plannedDateFor("2026-11-08", "")).toBeNull();
  });
});

describe("formatTimeLabel", () => {
  it("formats 12-hour times", () => {
    expect(formatTimeLabel("19:00")).toBe("7:00 PM");
    expect(formatTimeLabel("09:05")).toBe("9:05 AM");
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("12:30")).toBe("12:30 PM");
  });
});

describe("weekDays", () => {
  it("returns the week containing the day, from a Sunday start", () => {
    // Sat Nov 7 2026 sits in the week of Sun Nov 1.
    const days = weekDays("2026-11-07", 0);
    expect(days[0]).toBe("2026-11-01");
    expect(days[6]).toBe("2026-11-07");
  });

  it("honours a Monday start", () => {
    const days = weekDays("2026-11-08", 1);
    expect(days[0]).toBe("2026-11-02");
    expect(days[6]).toBe("2026-11-08");
  });
});

describe("shiftWeeks", () => {
  it("moves by whole weeks across a month end", () => {
    expect(shiftWeeks("2026-11-28", 1)).toBe("2026-12-05");
    expect(shiftWeeks("2026-11-07", -1)).toBe("2026-10-31");
  });
});

describe("shortDayLabel", () => {
  it("reads like a title", () => {
    expect(shortDayLabel("2026-11-08")).toBe("Sun, Nov 8");
  });
});
