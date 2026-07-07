# scripts/regression.mjs

An end-to-end API regression check for the auth and authorization behaviour. It
mints signed session cookies for two throwaway test users and drives the real
API: session verification, zod validation, CRUD across tags / friends / gift
recipients / planner notes, the ownership (IDOR) checks — user B must get **403**
acting on user A's rows — and the `/api/process` internal-token guard. Everything
it creates it deletes again at the end.

## Run it

Point it at any running instance of the app (local build or a deployed URL). It
needs `SESSION_SECRET` to match the secret that instance runs with — that's how
the minted cookie verifies.

```bash
# against a local build
SESSION_SECRET="<the app's SESSION_SECRET>" \
BASE_URL="http://localhost:3000" \
node scripts/regression.mjs

# against a deployed instance
SESSION_SECRET="<the app's SESSION_SECRET>" \
BASE_URL="https://your-app.example.com" \
node scripts/regression.mjs
```

Exit code is `0` when every check passes, `1` otherwise.

## Notes

- It writes to whatever database the target app is connected to, using
  clearly-labelled test-user UUIDs, and cleans up via the app's own DELETE
  endpoints. Prefer pointing it at a staging database if you have one.
- Inside a Claude Code cloud sandbox the *local* app can't reach Supabase
  because Next.js bundles its own `fetch` that bypasses the sandbox egress
  proxy — run this from a normal machine, or against a deployed URL, instead.
