import { verifyBodySchema, sendCodeBodySchema } from "@/types/schemas/auth";
import {
  addPlanItemBodySchema,
  updatePlanItemBodySchema,
} from "@/types/schemas/planner";

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
