import {
  eventDateToPlannedDate,
  parseEventDate,
  toPlannerDateParams,
} from "@/lib/event-date";

/**
 * Every string below is a shape an extraction has actually written into
 * `EventData.date`, or one the old `new Date(str)` got confidently wrong. The
 * year-inference cases pin `now` so they do not rot.
 */
const NOW = new Date(2026, 7, 23); // Sun Aug 23 2026

function parse(dateStr: string, timeStr?: string) {
  return parseEventDate(dateStr, timeStr, NOW);
}

describe("parseEventDate — ranges", () => {
  it("takes the first day of a range, whichever dash was used", () => {
    for (const dash of ["-", "–", "—"]) {
      expect(parse(`September 5${dash}6, 2026`)).toEqual(new Date(2026, 8, 5));
    }
  });

  it("does not read the second half of a range as a year", () => {
    // "September 5-6" used to parse as September 5th, 2006.
    expect(parse("September 5-6")).toEqual(new Date(2026, 8, 5));
    // "March 21 & 22" used to parse as March 21st, 2022.
    expect(parse("March 21 & 22")).toEqual(new Date(2026, 2, 21));
  });

  it("finds a year written after a two-month range", () => {
    expect(parse("Nov 14 - Nov 16, 2026")).toEqual(new Date(2026, 10, 14));
  });
});

describe("parseEventDate — formats", () => {
  it.each([
    ["Saturday, April 18, 2026", new Date(2026, 3, 18)],
    ["Nov 14, 2026", new Date(2026, 10, 14)],
    ["Jan 3 2027", new Date(2027, 0, 3)],
    ["5 September 2026", new Date(2026, 8, 5)],
    ["sept. 12, 2026", new Date(2026, 8, 12)],
    ["11/14/2026", new Date(2026, 10, 14)],
    ["11/14/26", new Date(2026, 10, 14)],
  ])("reads %s", (input, expected) => {
    expect(parse(input)).toEqual(expected);
  });

  it("strips ordinal suffixes", () => {
    expect(parse("December 6th, 2026")).toEqual(new Date(2026, 11, 6));
    expect(parse("March 1st, 2027")).toEqual(new Date(2027, 2, 1));
    expect(parse("May 22nd, 2027")).toEqual(new Date(2027, 4, 22));
    expect(parse("July 3rd, 2027")).toEqual(new Date(2027, 6, 3));
  });

  it("reads an ISO date as a local day, not a UTC instant", () => {
    // new Date("2026-11-14") is UTC midnight, which is the 13th in the US.
    expect(parse("2026-11-14")).toEqual(new Date(2026, 10, 14));
  });

  it("finds the date inside a sentence", () => {
    expect(parse("Opening night: Nov 14, 2026")).toEqual(
      new Date(2026, 10, 14)
    );
  });

  it("prefers a written-out month over a bare pair of numbers", () => {
    expect(parse("Nov 14, 2026 (7/9 sold)")).toEqual(new Date(2026, 10, 14));
  });
});

describe("parseEventDate — the year, when the string omits it", () => {
  it("keeps this year for a date still ahead", () => {
    expect(parse("November 14")).toEqual(new Date(2026, 10, 14));
    expect(parse("December 6")).toEqual(new Date(2026, 11, 6));
  });

  it("keeps this year for a date only just past", () => {
    expect(parse("August 1")).toEqual(new Date(2026, 7, 1));
  });

  it("rolls to next year for a date long gone", () => {
    // Seen in August, "January 3" is the January that is coming.
    expect(parse("January 3")).toEqual(new Date(2027, 0, 3));
  });

  it("never invents 2001 for a bare month and day", () => {
    // new Date("November 14") returns November 14th, 2001.
    expect(parse("November 14")?.getFullYear()).toBe(2026);
    expect(parse("Thursday November 20")?.getFullYear()).toBe(2026);
  });
});

describe("parseEventDate — refusals", () => {
  it.each([
    "TBD",
    "Every Saturday",
    "September 2026",
    "Check the website",
    "",
    "   ",
  ])("returns null for %s rather than guessing", (input) => {
    expect(parse(input)).toBeNull();
  });

  it("returns null for a day that does not exist", () => {
    expect(parse("Feb 30, 2026")).toBeNull();
    expect(parse("2026-02-30")).toBeNull();
  });

  it("handles missing and non-string input", () => {
    expect(parseEventDate(undefined)).toBeNull();
    expect(parseEventDate(undefined, "7:00 PM")).toBeNull();
    expect(parseEventDate(42 as unknown as string)).toBeNull();
  });
});

describe("parseEventDate — time", () => {
  it("applies a 12-hour time to the parsed day", () => {
    expect(parse("Nov 14, 2026", "7:30 PM")).toEqual(
      new Date(2026, 10, 14, 19, 30)
    );
    expect(parse("Nov 14, 2026", "12:15 AM")).toEqual(
      new Date(2026, 10, 14, 0, 15)
    );
    expect(parse("Nov 14, 2026", "12:00 PM")).toEqual(
      new Date(2026, 10, 14, 12, 0)
    );
  });

  it("leaves the day at midnight when the time is unreadable", () => {
    expect(parse("Nov 14, 2026", "doors at dusk")).toEqual(
      new Date(2026, 10, 14)
    );
    expect(parse("Nov 14, 2026", "99:99")).toEqual(new Date(2026, 10, 14));
  });
});

describe("toPlannerDateParams", () => {
  it("builds the query the planner reads", () => {
    expect(toPlannerDateParams("Saturday, April 18, 2026")).toBe(
      "date=2026-04-18"
    );
  });

  it("gives the caller nothing to jump to when the date is unreadable", () => {
    expect(toPlannerDateParams("TBD")).toBeNull();
    expect(toPlannerDateParams(undefined)).toBeNull();
  });
});

describe("eventDateToPlannedDate", () => {
  it("stores the local calendar day and wall clock in the UTC fields", () => {
    expect(eventDateToPlannedDate(new Date(2026, 10, 14, 19, 30))).toBe(
      "2026-11-14T19:30:00.000Z"
    );
  });
});
