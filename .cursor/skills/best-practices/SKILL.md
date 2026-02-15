---
name: best-practices
description: Enforce project coding standards and architectural patterns during development. Use when writing new code, adding features, creating components, API routes, hooks, or database functions. Prevents regressions to pre-refactor patterns like duplicated auth, monolithic files, or direct Supabase client usage in routes.
---

# Best Practices Enforcement

Follow these rules when writing or modifying code in this project. These patterns were established during a comprehensive refactor and must be maintained.

## Architecture Rules

### Auth: Use `@/lib/auth`
- **NEVER** define `getSessionUser()` or `SessionData` in a route file.
- Import `requireSession` from `@/lib/auth` for all protected routes.
- Pattern:
```typescript
import { requireSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await requireSession(request);
  if (errorResponse) return errorResponse;
  // session.userId, session.phoneNumber available
}
```

### Database: Use `@/lib/db/*` modules
- **NEVER** call `createServerClient()` directly in route files.
- All DB operations go through domain modules in `src/lib/db/`:
  - `users.ts` -- user CRUD, phone auth
  - `content.ts` -- content CRUD
  - `planner.ts` -- weekly plans, plan items
  - `gifts.ts` -- gift recipients, assignments
  - `tags.ts` -- tags, content-tag associations
  - `settings.ts` -- user settings
  - `friends.ts` -- friend CRUD
  - `sharing.ts` -- plan sharing, item sharing
  - `storage.ts` -- thumbnail upload/delete
  - `grocery-cache.ts` -- grocery list caching
- Import via `@/lib/supabase` (barrel re-export) or directly from `@/lib/db/module`.
- New domain? Create a new file in `src/lib/db/`, export from `index.ts`.

### Types: Use `@/lib/db/types` or `@/types`
- All shared interfaces live in `src/lib/db/types.ts` (DB types) or `src/types/` (API/session types).
- **NEVER** define `interface SessionData` inline in a file.

### Processing: Use `@/lib/processing`
- Content processing pipeline lives in `src/lib/processing/`.
- The route at `api/process` is a thin handler calling `processContent()`.
- New platform? Add a processor file in `src/lib/processing/`.

## Component Rules

### File size limits
- Page files (`page.tsx`): aim for under 300 lines. Extract components and hooks.
- Components: aim for under 200 lines.
- API routes: aim for under 150 lines.

### Extract shared patterns
- Modals: use `@/components/Modal` as the base.
- Loading/empty/error states: use `LoadingState`, `EmptyState`, `ErrorState` from `@/components`.
- Search with debounce: use `SearchInput` from `@/components`.
- Ingredient/step toggles: use `RecipeSteps` from `[id]/components/RecipeSteps`.
- Location cards: use `LocationCard` from `[id]/components/LocationCard`.

### Hooks
- `useModal` -- modal open/close with typed data payload.
- `useFilters` -- generic filter state with optional localStorage persistence.
- `usePlannerFilters` -- planner-specific search/category/tag filters.
- `useFriendSelector` -- friend list selection state.

### Date utilities
- Import date helpers from `@/lib/date-utils` (re-exports from `@/lib/utils`).
- Available: `parseDateString`, `formatDateString`, `getWeekStartDay`, `getOrderedDays`, `getWeekStartForDate`, `getDateSlotInWeek`.

## API Route Patterns

### Standard shape
```typescript
import { requireSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    // validate body...
    // call db module function...
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

### Validation (optional, for new routes)
- Use Zod schemas from `@/types/schemas/` for request body validation.
- Use `createHandler` from `@/lib/api-handler` for auth + validation wrapper.
- Use `apiError` / `apiValidationError` from `@/lib/api-response` for standard error shapes.

## Constants
- Session duration: `SESSION_EXPIRATION_MS` / `SESSION_EXPIRATION_SECONDS` from `@/lib/constants`.
- Categories: `CATEGORY_CONFIG`, `CATEGORY_EMOJI`, `DEFAULT_TAGS` from `@/lib/constants`.
- Add new magic values to `@/lib/constants.ts`, never hardcode.

## Session Security
- Sessions are HMAC-SHA256 signed (format: `v2.sig.payload`).
- `SESSION_SECRET` env var required (min 16 chars).
- Legacy unsigned cookies accepted for backward compat (will expire naturally).
- Never create session tokens manually; use `createSessionToken` from `@/lib/auth`.
