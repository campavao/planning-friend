import { verifyBodySchema, sendCodeBodySchema } from "@/lib/schemas/auth";
import {
  addPlanItemBodySchema,
  updatePlanItemBodySchema,
} from "@/lib/schemas/planner";
import {
  NOTE_BODY_MAX_LENGTH,
  createItemNoteBodySchema,
  updateItemNoteBodySchema,
} from "@/lib/schemas/item-notes";
import { updateUserSettingsBodySchema } from "@/lib/schemas/settings";

// ============================================
// Auth Schemas
// ============================================
describe("verifyBodySchema", () => {
  it("accepts valid phone number and code", () => {
    const result = verifyBodySchema.safeParse({
      phoneNumber: "+12125551234",
      code: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing phoneNumber", () => {
    const result = verifyBodySchema.safeParse({
      code: "123456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing code", () => {
    const result = verifyBodySchema.safeParse({
      phoneNumber: "+12125551234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty phoneNumber", () => {
    const result = verifyBodySchema.safeParse({
      phoneNumber: "",
      code: "123456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty code", () => {
    const result = verifyBodySchema.safeParse({
      phoneNumber: "+12125551234",
      code: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = verifyBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("sendCodeBodySchema", () => {
  it("accepts valid phone number", () => {
    const result = sendCodeBodySchema.safeParse({
      phoneNumber: "+12125551234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing phoneNumber", () => {
    const result = sendCodeBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty phoneNumber", () => {
    const result = sendCodeBodySchema.safeParse({ phoneNumber: "" });
    expect(result.success).toBe(false);
  });
});

// ============================================
// Planner Schemas
// ============================================
describe("addPlanItemBodySchema", () => {
  it("accepts item with contentId", () => {
    const result = addPlanItemBodySchema.safeParse({
      contentId: "550e8400-e29b-41d4-a716-446655440000",
      weekStart: "2024-01-14",
      dayOfWeek: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts item with noteTitle", () => {
    const result = addPlanItemBodySchema.safeParse({
      noteTitle: "Buy groceries",
      weekStart: "2024-01-14",
      dayOfWeek: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects item with neither contentId nor noteTitle", () => {
    const result = addPlanItemBodySchema.safeParse({
      weekStart: "2024-01-14",
      dayOfWeek: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with empty noteTitle and no contentId", () => {
    const result = addPlanItemBodySchema.safeParse({
      noteTitle: "",
      weekStart: "2024-01-14",
      dayOfWeek: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfWeek out of range (negative)", () => {
    const result = addPlanItemBodySchema.safeParse({
      contentId: "550e8400-e29b-41d4-a716-446655440000",
      dayOfWeek: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfWeek out of range (too high)", () => {
    const result = addPlanItemBodySchema.safeParse({
      contentId: "550e8400-e29b-41d4-a716-446655440000",
      dayOfWeek: 7,
    });
    expect(result.success).toBe(false);
  });

  it("accepts dayOfWeek boundary values 0 and 6", () => {
    const result0 = addPlanItemBodySchema.safeParse({
      contentId: "550e8400-e29b-41d4-a716-446655440000",
      dayOfWeek: 0,
    });
    const result6 = addPlanItemBodySchema.safeParse({
      contentId: "550e8400-e29b-41d4-a716-446655440000",
      dayOfWeek: 6,
    });
    expect(result0.success).toBe(true);
    expect(result6.success).toBe(true);
  });

  it("rejects non-UUID contentId", () => {
    const result = addPlanItemBodySchema.safeParse({
      contentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts nullable contentId with noteTitle", () => {
    const result = addPlanItemBodySchema.safeParse({
      contentId: null,
      noteTitle: "My note",
    });
    expect(result.success).toBe(true);
  });

  it("allows optional notes", () => {
    const result = addPlanItemBodySchema.safeParse({
      contentId: "550e8400-e29b-41d4-a716-446655440000",
      notes: "Some additional notes",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Some additional notes");
    }
  });
});

describe("updatePlanItemBodySchema", () => {
  it("accepts valid update with contentId", () => {
    const result = updatePlanItemBodySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      contentId: "660e8400-e29b-41d4-a716-446655440000",
      plannedDate: "2024-01-17T19:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid update with noteTitle", () => {
    const result = updatePlanItemBodySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      noteTitle: "Updated note",
      plannedDate: "2024-01-17T19:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = updatePlanItemBodySchema.safeParse({
      contentId: "660e8400-e29b-41d4-a716-446655440000",
      plannedDate: "2024-01-17T19:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing plannedDate", () => {
    const result = updatePlanItemBodySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      contentId: "660e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-datetime plannedDate", () => {
    const result = updatePlanItemBodySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      contentId: "660e8400-e29b-41d4-a716-446655440000",
      plannedDate: "2024-01-17",
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with neither contentId nor noteTitle", () => {
    const result = updatePlanItemBodySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      plannedDate: "2024-01-17T19:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// Item Note Schemas
// ============================================
describe("createItemNoteBodySchema", () => {
  it("accepts a note with just a body", () => {
    const result = createItemNoteBodySchema.safeParse({
      body: "Way too salty, halve the soy sauce next time.",
    });
    expect(result.success).toBe(true);
  });

  it("trims the body", () => {
    const result = createItemNoteBodySchema.safeParse({ body: "  good  " });
    expect(result.success && result.data.body).toBe("good");
  });

  it("rejects an empty or whitespace-only body", () => {
    expect(createItemNoteBodySchema.safeParse({ body: "" }).success).toBe(false);
    expect(createItemNoteBodySchema.safeParse({ body: "   " }).success).toBe(
      false
    );
  });

  it("rejects a body past the length cap", () => {
    const ok = createItemNoteBodySchema.safeParse({
      body: "x".repeat(NOTE_BODY_MAX_LENGTH),
    });
    const tooLong = createItemNoteBodySchema.safeParse({
      body: "x".repeat(NOTE_BODY_MAX_LENGTH + 1),
    });
    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it("accepts ratings 1 through 5 and nothing outside", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(
        createItemNoteBodySchema.safeParse({ body: "ok", rating }).success
      ).toBe(true);
    }
    for (const rating of [0, 6, -1, 2.5]) {
      expect(
        createItemNoteBodySchema.safeParse({ body: "ok", rating }).success
      ).toBe(false);
    }
  });

  it("allows a note with no rating at all", () => {
    expect(
      createItemNoteBodySchema.safeParse({ body: "ok", rating: null }).success
    ).toBe(true);
    expect(createItemNoteBodySchema.safeParse({ body: "ok" }).success).toBe(
      true
    );
  });

  it("rejects a non-UUID planItemId", () => {
    expect(
      createItemNoteBodySchema.safeParse({ body: "ok", planItemId: "nope" })
        .success
    ).toBe(false);
  });
});

describe("updateItemNoteBodySchema", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a body-only edit", () => {
    expect(updateItemNoteBodySchema.safeParse({ id, body: "revised" }).success).toBe(
      true
    );
  });

  it("accepts clearing the rating", () => {
    expect(updateItemNoteBodySchema.safeParse({ id, rating: null }).success).toBe(
      true
    );
  });

  it("rejects an update that changes nothing", () => {
    expect(updateItemNoteBodySchema.safeParse({ id }).success).toBe(false);
  });

  it("rejects a missing or malformed id", () => {
    expect(updateItemNoteBodySchema.safeParse({ body: "x" }).success).toBe(false);
    expect(
      updateItemNoteBodySchema.safeParse({ id: "abc", body: "x" }).success
    ).toBe(false);
  });
});

// ============================================
// Settings Schema
// ============================================
describe("updateUserSettingsBodySchema", () => {
  it("keeps the note-reminder fields", () => {
    // The regression this guards: the route used to destructure only the two
    // location fields, so the toggle appeared to save and never did.
    const result = updateUserSettingsBodySchema.safeParse({
      note_reminders_enabled: false,
      note_reminder_delay_minutes: 240,
    });
    expect(result.success && result.data).toEqual({
      note_reminders_enabled: false,
      note_reminder_delay_minutes: 240,
    });
  });

  it("keeps the location fields", () => {
    const result = updateUserSettingsBodySchema.safeParse({
      home_region: "Chicago, IL",
      home_country: "United States",
    });
    expect(result.success && result.data).toEqual({
      home_region: "Chicago, IL",
      home_country: "United States",
    });
  });

  it("omits absent fields rather than nulling them", () => {
    // Keys that aren't in the body must not reach the upsert, or a partial
    // save would wipe the settings it didn't mention.
    const result = updateUserSettingsBodySchema.safeParse({
      home_region: "Chicago, IL",
    });
    expect(result.success && Object.keys(result.data)).toEqual(["home_region"]);
  });

  it("drops unknown keys instead of writing them", () => {
    const result = updateUserSettingsBodySchema.safeParse({
      home_region: "Chicago, IL",
      user_id: "somebody-elses-id",
    });
    expect(result.success && result.data).toEqual({
      home_region: "Chicago, IL",
    });
  });

  it("rejects a delay outside the supported range", () => {
    expect(
      updateUserSettingsBodySchema.safeParse({ note_reminder_delay_minutes: 0 })
        .success
    ).toBe(false);
    expect(
      updateUserSettingsBodySchema.safeParse({
        note_reminder_delay_minutes: 10081,
      }).success
    ).toBe(false);
    expect(
      updateUserSettingsBodySchema.safeParse({
        note_reminder_delay_minutes: 120,
      }).success
    ).toBe(true);
  });

  it("rejects a non-boolean toggle", () => {
    expect(
      updateUserSettingsBodySchema.safeParse({ note_reminders_enabled: "true" })
        .success
    ).toBe(false);
  });
});
