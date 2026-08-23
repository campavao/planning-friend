/**
 * The day list behind "add to planner" on the item page (PLA-41).
 *
 * The labels are the whole point: "Tuesday" on its own is ambiguous twice over
 * in a fortnight, so every row carries a date, and the first two rows say what
 * a person would say instead of naming the weekday.
 */

import { upcomingDays } from "@/lib/plan-dates";

// A Wednesday, so the weekday sequence is easy to read in the assertions.
const WEDNESDAY = new Date("2026-08-26T09:15:00");

describe("upcomingDays", () => {
  it("names today and tomorrow rather than their weekdays", () => {
    const days = upcomingDays(4, WEDNESDAY);

    expect(days.map((d) => d.label)).toEqual([
      "Today",
      "Tomorrow",
      "Friday",
      "Saturday",
    ]);
  });

  it("always carries a date, since a weekday alone repeats within the range", () => {
    const days = upcomingDays(14, WEDNESDAY);

    // Two Fridays inside a fortnight — distinguishable only by the sub-label.
    const fridays = days.filter((d) => d.label === "Friday");
    expect(fridays.length).toBeGreaterThan(1);
    expect(new Set(fridays.map((d) => d.sub)).size).toBe(fridays.length);
    expect(days.every((d) => d.sub.length > 0)).toBe(true);
  });

  it("puts every day at the planner's own default slot", () => {
    // 19:00 local, matching what the planner uses when adding by day index —
    // an item added from either place has to land in the same slot.
    for (const { date } of upcomingDays(5, WEDNESDAY)) {
      expect(date.getHours()).toBe(19);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    }
  });

  it("advances by exactly one calendar day per entry", () => {
    const days = upcomingDays(7, WEDNESDAY);

    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1].date;
      const curr = days[i].date;
      const deltaDays = Math.round(
        (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(deltaDays).toBe(1);
    }
  });

  it("starts from today, not tomorrow", () => {
    const [first] = upcomingDays(1, WEDNESDAY);

    expect(first.date.getDate()).toBe(WEDNESDAY.getDate());
    expect(first.label).toBe("Today");
  });
});
