---
name: codebase-health
description: Assess codebase health and detect architectural drift. Use when the user asks to check code quality, audit the codebase, find technical debt, or ensure coding standards are being followed. Produces an actionable report of violations and recommendations.
---

# Codebase Health Assessment

Run this audit to detect regressions, architectural drift, and growing technical debt.

## Step 1: Structural scan

Use search tools to gather these metrics. Report each as a number.

**File sizes** (flag files exceeding limits):
- `src/app/**/page.tsx` files over 300 lines
- `src/components/**/*.tsx` files over 200 lines
- `src/app/api/**/route.ts` files over 150 lines
- `src/lib/**/*.ts` files over 300 lines (excluding `db/types.ts`)

**Barrel health**:
- Check `src/lib/db/index.ts` re-exports all modules in `src/lib/db/`.
- Check `src/lib/supabase.ts` is still a thin re-export (`export * from "./db"`).

## Step 2: Pattern violations

Search for these anti-patterns and list every file that violates:

1. **Duplicated auth**: Search for `interface SessionData` or `function getSessionUser` outside of `src/lib/auth.ts`. Should find zero matches.
2. **Direct Supabase in routes**: Search for `createServerClient()` in `src/app/api/`. Should only appear if a new db function hasn't been extracted yet. Flag any occurrence.
3. **Hardcoded session expiry**: Search for `7 * 24 * 60 * 60` outside of `src/lib/constants.ts`. Should find zero matches.
4. **Missing auth import**: Search for `cookies` imported from `next/headers` in route files (means they're parsing sessions manually instead of using `requireSession`).
5. **Inline types**: Search for `interface Content {` or `interface PlanItem {` outside of `src/lib/db/types.ts`. Flag any that duplicate the canonical definitions.

## Step 3: Component reuse

Check whether shared components are being used:

1. Search for inline modal backdrops (`fixed inset-0 z-50` pattern) outside of `src/components/Modal.tsx`. Flag files that should use the `Modal` component.
2. Search for duplicated loading spinners (`loading-spinner` or `animate-spin`) in page files. Should use `LoadingState` component.
3. Search for duplicated ingredient/step toggle logic in content pages. Should use `RecipeSteps`.

## Step 4: Hook reuse

1. Search for `localStorage.getItem` in page files. These should use `useFilters` or a custom hook instead of raw localStorage.
2. Search for inline `useState<Set` patterns for friend selection. Should use `useFriendSelector`.

## Step 5: Report

Format the results as:

```
## Codebase Health Report

### Metrics
- Files over size limit: X
- Pattern violations: X
- Reuse opportunities: X

### Violations (must fix)
1. [file:line] Description of violation

### Warnings (should fix)
1. [file] Description of concern

### Recommendations
- Actionable next steps ranked by impact
```

Prioritize violations by severity:
- **Critical**: Auth duplication, direct Supabase client in routes (security/consistency risk)
- **High**: Files over 500 lines, hardcoded constants
- **Medium**: Missing component reuse, raw localStorage
- **Low**: Files slightly over limit, minor duplication

## Frequency

Run this audit:
- Before major feature branches are merged
- Monthly as a health check
- After any agent makes significant changes
