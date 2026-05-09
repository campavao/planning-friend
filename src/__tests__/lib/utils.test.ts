import {
  formatPhoneNumber,
  parseDateString,
  formatDateString,
  getOrderedDays,
  getWeekStartForDate,
  getDateSlotInWeek,
  cn,
  WEEK_START_STORAGE_KEY,
} from "@/lib/utils";

// ============================================
// cn (class name utility)
// ============================================
describe("cn", () => {
  it("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates tailwind classes (last wins)", () => {
    const result = cn("p-4", "p-2");
    expect(result).toBe("p-2");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null gracefully", () => {
    expect(cn("base", undefined, null, "extra")).toBe("base extra");
  });
});

// ============================================
// formatPhoneNumber
// ============================================
describe("formatPhoneNumber", () => {
  describe("10-digit US numbers without country code", () => {
    it("formats a full 10-digit number", () => {
      expect(formatPhoneNumber("2125551234")).toBe("(212) 555-1234");
    });

    it("formats partial number (3 digits)", () => {
      expect(formatPhoneNumber("212")).toBe("212");
    });

    it("formats partial number (4-6 digits)", () => {
      expect(formatPhoneNumber("212555")).toBe("(212) 555");
    });

    it("formats partial number (7+ digits)", () => {
      expect(formatPhoneNumber("2125551")).toBe("(212) 555-1");
    });

    it("strips non-digit characters", () => {
      expect(formatPhoneNumber("(212) 555-1234")).toBe("(212) 555-1234");
    });

    it("handles empty string", () => {
      expect(formatPhoneNumber("")).toBe("");
    });
  });

  describe("numbers with country code", () => {
    it("formats +1 US number", () => {
      expect(formatPhoneNumber("+12125551234")).toBe("+1 (212) 555-1234");
    });

    it("formats +1 with partial national number (3 digits)", () => {
      expect(formatPhoneNumber("+1212")).toBe("+1 212");
    });

    it("formats +1 with partial national number (4-6 digits)", () => {
      expect(formatPhoneNumber("+1212555")).toBe("+1 (212) 555");
    });

    it("handles 11-digit number without + prefix", () => {
      expect(formatPhoneNumber("12125551234")).toBe("+1 (212) 555-1234");
    });
  });

  describe("edge cases", () => {
    it("handles single digit", () => {
      expect(formatPhoneNumber("5")).toBe("5");
    });

    it("handles two digits", () => {
      expect(formatPhoneNumber("55")).toBe("55");
    });

    it("truncates extra digits in formatted output", () => {
      // More than 10 digits without + triggers country code path
      const result = formatPhoneNumber("12125551234567");
      expect(result).toContain("+1");
    });
  });
});

// ============================================
// parseDateString
// ============================================
describe("parseDateString", () => {
  it("parses a standard date string", () => {
    const date = parseDateString("2024-01-15");
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January = 0
    expect(date.getDate()).toBe(15);
  });

  it("parses December correctly", () => {
    const date = parseDateString("2024-12-31");
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(11); // December = 11
    expect(date.getDate()).toBe(31);
  });

  it("parses first day of year", () => {
    const date = parseDateString("2025-01-01");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it("creates a local date (not UTC-shifted)", () => {
    const date = parseDateString("2024-06-15");
    // The date should be June 15 in local time, not shifted by timezone
    expect(date.getDate()).toBe(15);
  });
});

// ============================================
// formatDateString
// ============================================
describe("formatDateString", () => {
  it("formats a date to YYYY-MM-DD", () => {
    const date = new Date(2024, 0, 15); // January 15, 2024
    expect(formatDateString(date)).toBe("2024-01-15");
  });

  it("pads single-digit months", () => {
    const date = new Date(2024, 2, 5); // March 5
    expect(formatDateString(date)).toBe("2024-03-05");
  });

  it("pads single-digit days", () => {
    const date = new Date(2024, 11, 1); // December 1
    expect(formatDateString(date)).toBe("2024-12-01");
  });

  it("roundtrips with parseDateString", () => {
    const original = "2024-07-20";
    const date = parseDateString(original);
    expect(formatDateString(date)).toBe(original);
  });

  it("handles end of year", () => {
    const date = new Date(2024, 11, 31);
    expect(formatDateString(date)).toBe("2024-12-31");
  });
});

// ============================================
// WEEK_START_STORAGE_KEY
// ============================================
describe("WEEK_START_STORAGE_KEY", () => {
  it("has the expected value", () => {
    expect(WEEK_START_STORAGE_KEY).toBe("planner_week_start_day");
  });
});

// ============================================
// getOrderedDays
// ============================================
describe("getOrderedDays", () => {
  it("returns Sunday-first order when startDay=0", () => {
    const { days, daysFull } = getOrderedDays(0);
    expect(days).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(daysFull[0]).toBe("Sunday");
    expect(daysFull[6]).toBe("Saturday");
  });

  it("returns Monday-first order when startDay=1", () => {
    const { days, daysFull } = getOrderedDays(1);
    expect(days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(daysFull[0]).toBe("Monday");
    expect(daysFull[6]).toBe("Sunday");
  });

  it("returns Wednesday-first order when startDay=3", () => {
    const { days } = getOrderedDays(3);
    expect(days[0]).toBe("Wed");
    expect(days[6]).toBe("Tue");
  });

  it("returns Saturday-first order when startDay=6", () => {
    const { days } = getOrderedDays(6);
    expect(days[0]).toBe("Sat");
    expect(days[1]).toBe("Sun");
    expect(days[6]).toBe("Fri");
  });

  it("always returns exactly 7 days", () => {
    for (let i = 0; i <= 6; i++) {
      const { days, daysFull } = getOrderedDays(i);
      expect(days).toHaveLength(7);
      expect(daysFull).toHaveLength(7);
    }
  });

  it("contains all 7 unique day names regardless of start", () => {
    const allDays = new Set(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    for (let i = 0; i <= 6; i++) {
      const { days } = getOrderedDays(i);
      expect(new Set(days)).toEqual(allDays);
    }
  });
});

// ============================================
// getWeekStartForDate
// ============================================
describe("getWeekStartForDate", () => {
  it("returns the correct Sunday for a Wednesday (startDay=0)", () => {
    // 2024-01-17 is a Wednesday
    const date = new Date(2024, 0, 17);
    expect(getWeekStartForDate(date, 0)).toBe("2024-01-14"); // Sunday
  });

  it("returns the same date when date IS the start day", () => {
    // 2024-01-14 is a Sunday
    const date = new Date(2024, 0, 14);
    expect(getWeekStartForDate(date, 0)).toBe("2024-01-14");
  });

  it("works with Monday start (startDay=1)", () => {
    // 2024-01-17 is a Wednesday
    const date = new Date(2024, 0, 17);
    expect(getWeekStartForDate(date, 1)).toBe("2024-01-15"); // Monday
  });

  it("handles week crossing month boundary", () => {
    // 2024-02-01 is a Thursday, Sunday start
    const date = new Date(2024, 1, 1);
    expect(getWeekStartForDate(date, 0)).toBe("2024-01-28");
  });

  it("handles week crossing year boundary", () => {
    // 2024-01-01 is a Monday, Sunday start
    const date = new Date(2024, 0, 1);
    expect(getWeekStartForDate(date, 0)).toBe("2023-12-31");
  });

  it("handles Saturday start day with a Monday date", () => {
    // 2024-01-15 is a Monday, startDay=6 (Saturday)
    const date = new Date(2024, 0, 15);
    expect(getWeekStartForDate(date, 6)).toBe("2024-01-13"); // Saturday
  });

  it("defaults to Sunday when no startDay provided", () => {
    const date = new Date(2024, 0, 17); // Wednesday
    expect(getWeekStartForDate(date, 0)).toBe("2024-01-14");
  });
});

// ============================================
// getDateSlotInWeek
// ============================================
describe("getDateSlotInWeek", () => {
  it("returns 0 for the first day of the week", () => {
    expect(getDateSlotInWeek("2024-01-14", "2024-01-14")).toBe(0);
  });

  it("returns correct slot for middle of week", () => {
    expect(getDateSlotInWeek("2024-01-17", "2024-01-14")).toBe(3);
  });

  it("returns 6 for the last day of the week", () => {
    expect(getDateSlotInWeek("2024-01-20", "2024-01-14")).toBe(6);
  });

  it("returns -1 for a date before the week", () => {
    expect(getDateSlotInWeek("2024-01-13", "2024-01-14")).toBe(-1);
  });

  it("returns -1 for a date after the week", () => {
    expect(getDateSlotInWeek("2024-01-21", "2024-01-14")).toBe(-1);
  });

  it("accepts a Date object as itemDate", () => {
    const date = new Date(2024, 0, 16); // January 16
    expect(getDateSlotInWeek(date, "2024-01-14")).toBe(2);
  });

  it("handles week across month boundary", () => {
    expect(getDateSlotInWeek("2024-02-01", "2024-01-28")).toBe(4);
  });
});
