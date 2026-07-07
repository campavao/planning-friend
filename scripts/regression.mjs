#!/usr/bin/env node
/**
 * End-to-end API regression check for the auth + authorization changes.
 *
 * It mints valid signed session cookies for two throwaway test users (A and B)
 * using SESSION_SECRET, then drives the real API:
 *   - session cookie signing/verification (and forged-cookie rejection)
 *   - zod body validation (400 on bad input)
 *   - CRUD across tags / friends / gift recipients / planner quick-notes
 *   - the ownership (IDOR) checks: user B must get 403 acting on user A's rows
 *   - /api/process requires the internal token
 * Everything it creates is deleted again at the end.
 *
 * Usage (run from a machine or CI with normal network egress):
 *   SESSION_SECRET=<the app's secret> \
 *   BASE_URL=http://localhost:3000 \
 *   node scripts/regression.mjs
 *
 * BASE_URL can point at a local `npm start` or a deployed URL. SESSION_SECRET
 * must match the one the target app runs with (that's how the cookie verifies).
 */
import crypto from "crypto";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  console.error("SESSION_SECRET is required (must match the target app).");
  process.exit(2);
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function mintCookie(userId, phone) {
  const payload = JSON.stringify({ userId, phoneNumber: phone, exp: Date.now() + 3600_000 });
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest();
  return "v2." + b64url(sig) + "." + b64url(Buffer.from(payload));
}

// Unique test UUIDs so a re-run never collides and cleanup is unambiguous.
const suffix = Date.now().toString().slice(-12).padStart(12, "0");
const A = "aaaaaaaa-0000-4000-8000-" + suffix;
const B = "bbbbbbbb-0000-4000-8000-" + suffix;
const cookieA = mintCookie(A, "+15550000001");
const cookieB = mintCookie(B, "+15550000002");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
};

async function req(path, { method = "GET", cookie, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: `session=${cookie}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const made = { tagIds: [], recipientIds: [], friendIds: [], planItemIds: [] };
const week = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);

async function main() {
  console.log(`\nTarget: ${BASE}\nTest users A=${A.slice(0, 13)} B=${B.slice(0, 13)}\n`);

  // --- session ---
  let r = await req("/api/auth/session", { cookie: cookieA });
  check("valid cookie authenticates", r.status === 200 && r.json?.authenticated === true && r.json?.user?.id === A);
  r = await req("/api/auth/session");
  check("no cookie -> unauthenticated", r.json?.authenticated === false);
  r = await req("/api/auth/session", { cookie: "v2.forged.eyJ1c2VySWQiOiJ4In0" });
  check("forged cookie rejected", r.json?.authenticated === false);

  // --- reads ---
  for (const [label, path] of [
    ["content", "/api/content?includeTags=true"],
    ["tags", "/api/tags"],
    ["settings", "/api/settings"],
    ["friends", "/api/friends"],
    ["gift recipients", "/api/gifts/recipients?include=assignments"],
    ["planner", `/api/planner?week=${week}`],
  ]) {
    r = await req(path, { cookie: cookieA });
    check(`GET ${label} works`, r.status === 200, `status ${r.status}`);
  }

  // --- writes ---
  r = await req("/api/tags", { method: "POST", cookie: cookieA, body: { name: "regtest-" + suffix } });
  if (r.status === 200 && r.json?.tag?.id) made.tagIds.push(r.json.tag.id);
  check("create tag", made.tagIds.length === 1, `status ${r.status}`);

  r = await req("/api/friends", { method: "POST", cookie: cookieA, body: { name: "Reg Friend" } });
  if (r.status === 200 && r.json?.friend?.id) made.friendIds.push(r.json.friend.id);
  check("create friend", made.friendIds.length === 1, `status ${r.status}`);

  r = await req("/api/gifts/recipients", { method: "POST", cookie: cookieA, body: { name: "Reg Recipient" } });
  if (r.status === 200 && r.json?.recipient?.id) made.recipientIds.push(r.json.recipient.id);
  check("create gift recipient", made.recipientIds.length === 1, `status ${r.status}`);

  r = await req("/api/planner", { method: "POST", cookie: cookieA, body: { noteTitle: "Reg Note", plannedDate: `${week}T19:00:00.000Z` } });
  if (r.status === 200 && r.json?.item?.id) made.planItemIds.push(r.json.item.id);
  check("add planner quick note", made.planItemIds.length === 1, `status ${r.status}`);

  r = await req("/api/planner", { method: "POST", cookie: cookieA, body: { notes: "no title" } });
  check("invalid planner body rejected (zod 400)", r.status === 400, `status ${r.status}`);

  // --- ownership / IDOR: user B must be forbidden on user A's rows ---
  if (made.tagIds.length) {
    r = await req(`/api/tags?tagId=${made.tagIds[0]}`, { method: "DELETE", cookie: cookieB });
    check("IDOR: B cannot delete A's tag", r.status === 403, `status ${r.status}`);
  }
  if (made.recipientIds.length) {
    r = await req("/api/gifts/recipients", { method: "PATCH", cookie: cookieB, body: { id: made.recipientIds[0], name: "hacked" } });
    check("IDOR: B cannot rename A's recipient", r.status === 403, `status ${r.status}`);
  }
  if (made.friendIds.length) {
    r = await req("/api/friends", { method: "PATCH", cookie: cookieB, body: { id: made.friendIds[0], name: "hacked" } });
    check("IDOR: B cannot edit A's friend", r.status === 403, `status ${r.status}`);
  }
  if (made.planItemIds.length) {
    r = await req(`/api/planner/item?id=${made.planItemIds[0]}`, { method: "DELETE", cookie: cookieB });
    check("IDOR: B cannot delete A's plan item", r.status === 403, `status ${r.status}`);
    r = await req(`/api/planner/item/share?itemId=${made.planItemIds[0]}`, { cookie: cookieB });
    check("IDOR: B cannot read A's item share info", r.status === 403, `status ${r.status}`);
    r = await req(`/api/planner/item/share?itemId=${made.planItemIds[0]}`, { cookie: cookieA });
    check("owner CAN read own item share info", r.status === 200, `status ${r.status}`);
  }

  // --- internal endpoint ---
  r = await req("/api/process", { method: "POST", cookie: cookieA, body: { contentId: "x", socialUrl: "https://example.com", userId: A } });
  check("/api/process rejects without internal token", r.status === 403, `status ${r.status}`);

  // --- cleanup ---
  console.log("\n-- cleanup --");
  for (const id of made.planItemIds) console.log(`  plan item ${id.slice(0, 8)}: ${(await req(`/api/planner/item?id=${id}`, { method: "DELETE", cookie: cookieA })).status}`);
  for (const id of made.tagIds) console.log(`  tag ${id.slice(0, 8)}: ${(await req(`/api/tags?tagId=${id}`, { method: "DELETE", cookie: cookieA })).status}`);
  for (const id of made.friendIds) console.log(`  friend ${id.slice(0, 8)}: ${(await req(`/api/friends?id=${id}`, { method: "DELETE", cookie: cookieA })).status}`);
  for (const id of made.recipientIds) console.log(`  recipient ${id.slice(0, 8)}: ${(await req(`/api/gifts/recipients?id=${id}`, { method: "DELETE", cookie: cookieA })).status}`);

  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
