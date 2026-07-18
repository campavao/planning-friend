import {
  SESSION_EXPIRATION_MS,
  SESSION_EXPIRATION_SECONDS,
  DEFAULT_PLANNED_TIME,
  SHARE_INVITE_EXPIRY_MS,
  DEFAULT_TAGS,
  CATEGORY_CONFIG,
  categoryEmoji,
} from "@/lib/constants";

// ============================================
// Session constants
// ============================================
describe("session constants", () => {
  it("SESSION_EXPIRATION_MS equals 7 days in milliseconds", () => {
    expect(SESSION_EXPIRATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("SESSION_EXPIRATION_SECONDS equals 7 days in seconds", () => {
    expect(SESSION_EXPIRATION_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("SESSION_EXPIRATION_MS and SESSION_EXPIRATION_SECONDS are consistent", () => {
    expect(SESSION_EXPIRATION_MS).toBe(SESSION_EXPIRATION_SECONDS * 1000);
  });
});

// ============================================
// Planner constants
// ============================================
describe("planner constants", () => {
  it("DEFAULT_PLANNED_TIME is valid HH:mm format", () => {
    expect(DEFAULT_PLANNED_TIME).toMatch(/^\d{2}:\d{2}$/);
  });

  it("DEFAULT_PLANNED_TIME is 19:00", () => {
    expect(DEFAULT_PLANNED_TIME).toBe("19:00");
  });
});

// ============================================
// Share constants
// ============================================
describe("share constants", () => {
  it("SHARE_INVITE_EXPIRY_MS equals 7 days in milliseconds", () => {
    expect(SHARE_INVITE_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ============================================
// DEFAULT_TAGS
// ============================================
describe("DEFAULT_TAGS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(DEFAULT_TAGS)).toBe(true);
    expect(DEFAULT_TAGS.length).toBeGreaterThan(0);
  });

  it("contains only lowercase strings", () => {
    for (const tag of DEFAULT_TAGS) {
      expect(tag).toBe(tag.toLowerCase());
    }
  });

  it("contains no duplicates", () => {
    const uniqueTags = new Set(DEFAULT_TAGS);
    expect(uniqueTags.size).toBe(DEFAULT_TAGS.length);
  });

  it("contains expected common tags", () => {
    expect(DEFAULT_TAGS).toContain("quick");
    expect(DEFAULT_TAGS).toContain("dinner");
    expect(DEFAULT_TAGS).toContain("breakfast");
    expect(DEFAULT_TAGS).toContain("healthy");
    expect(DEFAULT_TAGS).toContain("vegetarian");
    expect(DEFAULT_TAGS).toContain("vegan");
  });

  it("all tags use kebab-case (no spaces or special chars)", () => {
    for (const tag of DEFAULT_TAGS) {
      expect(tag).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});

// ============================================
// CATEGORY_CONFIG
// ============================================
describe("CATEGORY_CONFIG", () => {
  const expectedCategories = [
    "meal",
    "drink",
    "event",
    "date_idea",
    "gift_idea",
    "travel",
    "other",
  ];

  it("has entries for all 7 categories", () => {
    for (const category of expectedCategories) {
      expect(CATEGORY_CONFIG[category]).toBeDefined();
    }
  });

  it("each entry has emoji and label", () => {
    for (const category of expectedCategories) {
      const config = CATEGORY_CONFIG[category];
      expect(config.emoji).toBeDefined();
      expect(config.emoji.length).toBeGreaterThan(0);
      expect(config.label).toBeDefined();
      expect(config.label.length).toBeGreaterThan(0);
    }
  });

  it("has human-readable labels matching the UI", () => {
    expect(CATEGORY_CONFIG.meal.label).toBe("Recipe");
    expect(CATEGORY_CONFIG.drink.label).toBe("Drink");
    expect(CATEGORY_CONFIG.event.label).toBe("Event");
    expect(CATEGORY_CONFIG.date_idea.label).toBe("Date");
    expect(CATEGORY_CONFIG.gift_idea.label).toBe("Gift");
    expect(CATEGORY_CONFIG.travel.label).toBe("Travel");
    expect(CATEGORY_CONFIG.other.label).toBe("Saved");
  });
});

// ============================================
// categoryEmoji
// ============================================
describe("categoryEmoji", () => {
  it("returns the emoji for each known category", () => {
    for (const key of Object.keys(CATEGORY_CONFIG)) {
      expect(categoryEmoji(key)).toBe(CATEGORY_CONFIG[key].emoji);
    }
  });

  it("falls back to a sparkle for unknown categories", () => {
    expect(categoryEmoji("nonexistent")).toBe("✨");
  });
});
