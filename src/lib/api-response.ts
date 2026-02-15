import { NextResponse } from "next/server";

export const API_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export function apiError(
  message: string,
  status: number = 400,
  code: string = API_ERROR_CODES.BAD_REQUEST
) {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  );
}

export function apiValidationError(message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, code: API_ERROR_CODES.VALIDATION_ERROR, details },
    { status: 400 }
  );
}
