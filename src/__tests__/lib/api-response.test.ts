/**
 * @jest-environment node
 */

// Mock NextResponse since it's from next/server
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}));

import { apiError, apiValidationError, API_ERROR_CODES } from "@/lib/api-response";

// ============================================
// API_ERROR_CODES
// ============================================
describe("API_ERROR_CODES", () => {
  it("has all expected error codes", () => {
    expect(API_ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(API_ERROR_CODES.BAD_REQUEST).toBe("BAD_REQUEST");
    expect(API_ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(API_ERROR_CODES.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(API_ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });

  it("has exactly 5 error codes", () => {
    expect(Object.keys(API_ERROR_CODES)).toHaveLength(5);
  });
});

// ============================================
// apiError
// ============================================
describe("apiError", () => {
  it("returns response with message and default status 400", () => {
    const response = apiError("Something went wrong") as unknown as {
      body: { success: boolean; error: string; code: string };
      status: number;
    };
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Something went wrong");
    expect(response.body.code).toBe("BAD_REQUEST");
    expect(response.status).toBe(400);
  });

  it("accepts custom status code", () => {
    const response = apiError("Not found", 404) as unknown as {
      body: { success: boolean; error: string; code: string };
      status: number;
    };
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("BAD_REQUEST"); // default code
  });

  it("accepts custom error code", () => {
    const response = apiError("Unauthorized", 401, API_ERROR_CODES.UNAUTHORIZED) as unknown as {
      body: { success: boolean; error: string; code: string };
      status: number;
    };
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});

// ============================================
// apiValidationError
// ============================================
describe("apiValidationError", () => {
  it("returns validation error response", () => {
    const response = apiValidationError("Invalid email") as unknown as {
      body: { success: boolean; error: string; code: string; details: unknown };
      status: number;
    };
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Invalid email");
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.status).toBe(400);
  });

  it("includes details when provided", () => {
    const details = { field: "email", issue: "invalid format" };
    const response = apiValidationError("Invalid", details) as unknown as {
      body: { success: boolean; error: string; code: string; details: unknown };
      status: number;
    };
    expect(response.body.details).toEqual(details);
  });

  it("has undefined details when not provided", () => {
    const response = apiValidationError("Invalid") as unknown as {
      body: { success: boolean; error: string; code: string; details: unknown };
      status: number;
    };
    expect(response.body.details).toBeUndefined();
  });
});
