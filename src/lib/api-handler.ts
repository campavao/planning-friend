import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema, ZodIssue } from "zod";
import { requireSession, type SessionData } from "@/lib/auth";
import { apiError, API_ERROR_CODES } from "./api-response";

type HandlerContext = {
  request: NextRequest;
  session: SessionData | null;
};

type Handler = (
  context: HandlerContext
) => Promise<NextResponse> | NextResponse;

export interface CreateHandlerConfig {
  auth: boolean;
  schema?: ZodSchema;
  handler: Handler;
}

/**
 * Wraps an API route handler with optional auth and request body validation.
 * Returns 401 if auth required and no session; 400 if validation fails.
 */
export function createHandler(config: CreateHandlerConfig) {
  return async function wrappedHandler(
    request: NextRequest
  ): Promise<NextResponse> {
    if (config.auth) {
      const { session, errorResponse } = await requireSession(request);
      if (errorResponse) return errorResponse;

      if (config.schema) {
        try {
          const body = await request.json();
          const parsed = config.schema.safeParse(body);
          if (!parsed.success) {
            return apiError(
              parsed.error.issues.map((e: ZodIssue) => e.message).join("; ") ||
                "Validation failed",
              400,
              API_ERROR_CODES.VALIDATION_ERROR
            );
          }
          (request as NextRequest & { parsedBody?: unknown }).parsedBody =
            parsed.data;
          return config.handler({
            request,
            session: session!,
          });
        } catch {
          return apiError("Invalid JSON body", 400);
        }
      }

      return config.handler({ request, session: session! });
    }

    if (config.schema) {
      try {
        const body = await request.json();
        const parsed = config.schema.safeParse(body);
        if (!parsed.success) {
          return apiError(
            parsed.error.issues.map((e: ZodIssue) => e.message).join("; ") ||
              "Validation failed",
            400,
            API_ERROR_CODES.VALIDATION_ERROR
          );
        }
        (request as NextRequest & { parsedBody?: unknown }).parsedBody =
          parsed.data;
        return config.handler({
          request,
          session: null!,
        });
      } catch {
        return apiError("Invalid JSON body", 400);
      }
    }

    return config.handler({
      request,
      session: null!,
    });
  };
}
