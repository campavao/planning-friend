import { parseSearchDate } from "@/app/dashboard/planner/lib/parse-search-date";

describe("parseSearchDate", () => {
  const today = new Date(2026, 6, 7); // July 7, 2026

  it("parses relative keywords", () => {
    expect(parseSearchDate("today", today)).toBe("2026-07-07");
    expect(parseSearchDate("Tomorrow", today)).toBe("2026-07-08");
    expect(parseSearchDate("yesterday", today)).toBe("2026-07-06");
  });

  it("parses ISO dates", () => {
    expect(parseSearchDate("2026-07-04", today)).toBe("2026-07-04");
    expect(parseSearchDate("2025-1-9", today)).toBe("2025-01-09");
  });

  it("parses slash dates, defaulting to the current year", () => {
    expect(parseSearchDate("7/4", today)).toBe("2026-07-04");
    expect(parseSearchDate("12/25/2025", today)).toBe("2025-12-25");
    expect(parseSearchDate("3/1/27", today)).toBe("2027-03-01");
  });

  it("parses month-name dates", () => {
    expect(parseSearchDate("July 4", today)).toBe("2026-07-04");
    expect(parseSearchDate("jul 4, 2027", today)).toBe("2027-07-04");
    expect(parseSearchDate("December 25 2025", today)).toBe("2025-12-25");
    expect(parseSearchDate("4 July", today)).toBe("2026-07-04");
    expect(parseSearchDate("March 3rd", today)).toBe("2026-03-03");
  });

  it("rejects invalid dates", () => {
    expect(parseSearchDate("2026-02-30", today)).toBeNull();
    expect(parseSearchDate("13/40", today)).toBeNull();
    expect(parseSearchDate("Febtember 3", today)).toBeNull();
  });

  it("returns null for non-date queries", () => {
    expect(parseSearchDate("", today)).toBeNull();
    expect(parseSearchDate("salmon tacos", today)).toBeNull();
    expect(parseSearchDate("date night", today)).toBeNull();
  });
});
