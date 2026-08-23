/**
 * Planning history statistics (PLA-46).
 *
 * Most of these are about restraint. The summary is shown on an item the cook
 * knows well, so a claim like "usually Tuesdays" is checked against their own
 * memory immediately — and a wrong one costs more trust than a missing one
 * would have earned.
 */

import {
  MIN_FOR_PATTERN,
  calendarDaysBetween,
  describeDaysSince,
  summarisePlanHistory,
  usualDayOf,
} from "@/lib/plan-history";

// A Sunday, 9am, so "today" boundaries are unambiguous in the assertions.
const NOW = new Date("2026-08-23T09:00:00");

function at(iso: string): string {
  return new Date(iso).toISOString();
}

describe("summarisePlanHistory", () => {
  it("counts only past occurrences and finds the most recent", () => {
    const summary = summarisePlanHistory(
      [
        at("2026-08-02T19:00:00"),
        at("2026-08-09T19:00:00"),
        at("2026-09-01T19:00:00"), // future
      ],
      NOW,
    );

    expect(summary.timesPlanned).toBe(2);
    expect(summary.lastPlanned).toBe(at("2026-08-09T19:00:00"));
    expect(summary.daysSince).toBe(14);
  });

  it("surfaces the soonest upcoming occurrence separately", () => {
    const summary = summarisePlanHistory(
      [at("2026-09-20T19:00:00"), at("2026-08-30T19:00:00")],
      NOW,
    );

    expect(summary.nextPlanned).toBe(at("2026-08-30T19:00:00"));
    expect(summary.timesPlanned).toBe(0);
  });

  it("treats something planned for tonight as had, not upcoming", () => {
    // 7pm today, from a 9am vantage point. Calling this "upcoming" all day is
    // pedantic — the cook has decided they are eating it.
    const summary = summarisePlanHistory([at("2026-08-23T19:00:00")], NOW);

    expect(summary.timesPlanned).toBe(1);
    expect(summary.daysSince).toBe(0);
    expect(summary.nextPlanned).toBeNull();
  });

  it("says nothing at all about an item never planned", () => {
    const summary = summarisePlanHistory([], NOW);

    expect(summary).toEqual({
      timesPlanned: 0,
      lastPlanned: null,
      daysSince: null,
      nextPlanned: null,
      usualDay: null,
    });
  });

  it("ignores unparseable dates rather than throwing", () => {
    const summary = summarisePlanHistory(
      ["not-a-date", at("2026-08-09T19:00:00")],
      NOW,
    );

    expect(summary.timesPlanned).toBe(1);
  });
});

describe("usualDayOf", () => {
  function sundays(count: number, weekday = 1): Date[] {
    // Successive weeks, all on the same weekday.
    const out: Date[] = [];
    const d = new Date("2026-06-01T19:00:00"); // a Monday
    d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
    for (let i = 0; i < count; i++) {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + i * 7);
      out.push(copy);
    }
    return out;
  }

  it("names a weekday once there is enough of a run", () => {
    expect(usualDayOf(sundays(MIN_FOR_PATTERN))).toBe("Monday");
  });

  it("stays quiet below the threshold", () => {
    // Three Mondays is a coincidence as easily as a habit.
    expect(usualDayOf(sundays(MIN_FOR_PATTERN - 1))).toBeNull();
  });

  it("stays quiet when two days tie", () => {
    // Three Mondays and three Fridays is not "usually Mondays" — it is a thing
    // eaten twice a week, and naming one would be wrong half the time.
    const tied = [...sundays(3, 1), ...sundays(3, 5)];

    expect(usualDayOf(tied)).toBeNull();
  });

  it("names the clear winner when one day leads outright", () => {
    const mostlyMondays = [...sundays(4, 1), ...sundays(1, 5)];

    expect(usualDayOf(mostlyMondays)).toBe("Monday");
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days, not elapsed hours", () => {
    // 8pm yesterday to 9am today is 13 hours, and every person calls it 1 day.
    const yesterdayEvening = new Date("2026-08-22T20:00:00");
    expect(calendarDaysBetween(yesterdayEvening, NOW)).toBe(1);
  });

  it("is zero within the same day", () => {
    expect(calendarDaysBetween(new Date("2026-08-23T01:00:00"), NOW)).toBe(0);
  });
});

describe("describeDaysSince", () => {
  it("uses words where words are what people say", () => {
    expect(describeDaysSince(0)).toBe("Today");
    expect(describeDaysSince(1)).toBe("Yesterday");
    expect(describeDaysSince(9)).toBe("9 days ago");
  });

  it("coarsens as the gap grows, because precision stops meaning anything", () => {
    expect(describeDaysSince(21)).toBe("3 weeks ago");
    expect(describeDaysSince(90)).toBe("3 months ago");
  });
});
