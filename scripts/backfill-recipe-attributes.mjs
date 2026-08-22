#!/usr/bin/env node
/**
 * Backfill the recipe attributes added by PLA-55/57 — effort, spice level,
 * equipment and the plant list — onto items saved before those fields existed.
 *
 * It works by re-running each item through the normal extraction pipeline, via
 * the app's own reprocess endpoint, rather than by patching rows directly. The
 * fields are derived from the original source, so there is nothing to compute
 * here that the pipeline does not already do better.
 *
 * WHAT THIS DESTROYS
 *
 * Re-processing rewrites `data` wholesale from the source. Any hand-edited
 * ingredient list or instruction step on a re-processed item is replaced by
 * whatever the extraction returns this time. That was accepted deliberately —
 * the dataset is two users and very little hand-editing — but the script still
 * counts the affected items and makes you look at the number before it starts.
 * `--skip-edited` opts out of touching them at all.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SESSION_SECRET=... \
 *   node scripts/backfill-recipe-attributes.mjs [options]
 *
 * Options:
 *   --url <base url>   App to drive (default http://localhost:3000)
 *   --apply            Actually re-process. Without it, this is a dry run.
 *   --skip-edited      Leave hand-edited items alone.
 *   --all              Re-process every meal/drink, not just the ones still
 *                      missing the new fields (the default).
 *   --id <uuid,...>    Re-process exactly these rows, whatever their category
 *                      or current state. For repairing items a previous run
 *                      damaged — they are no longer meal/drink, so the normal
 *                      candidate query cannot see them.
 *   --user <uuid>      Only touch one owner's rows.
 *   --category <name>  Only touch one category (meal or drink).
 *   --limit <n>        Stop after n items.
 *   --delay <ms>       Wait between items (default 4000). The pipeline calls
 *                      Gemini and a scraper; this keeps the run polite.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );
  process.exit(2);
}
if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET is required — it mints the session cookie the reprocess route checks."
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const baseUrl = (getArg("--url", "http://localhost:3000")).replace(/\/$/, "");
const apply = args.includes("--apply");
const skipEdited = args.includes("--skip-edited");
const all = args.includes("--all");
const limit = Number(getArg("--limit", "0")) || 0;
const onlyUser = getArg("--user", "") || "";
const onlyCategory = getArg("--category", "") || "";
const explicitIds = (getArg("--id", "") || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const delayMs = Number(getArg("--delay", "4000"));

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Mint the same signed session cookie the app issues, so the reprocess route
 * sees a normal authenticated request from the item's owner.
 *
 * Format is `v2.<signature>.<payload>` with the HMAC taken over the raw JSON —
 * signature first, which is easy to get backwards. Same shape as
 * scripts/regression.mjs; both track createSessionToken in src/lib/auth.ts, and
 * a drift there shows up here as a 401 rather than as silent corruption.
 */
function mintSession(userId, phoneNumber) {
  const payload = JSON.stringify({
    userId,
    phoneNumber,
    exp: Date.now() + 3600_000,
  });
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest();
  return "v2." + b64url(sig) + "." + b64url(Buffer.from(payload));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const query = supabase
    .from("content")
    .select("id, user_id, title, category, data, status, tiktok_url");
  let scoped = query;
  if (!explicitIds.length) {
    scoped = scoped
      .in("category", onlyCategory ? [onlyCategory] : ["meal", "drink"])
      .eq("status", "completed");
    if (onlyUser) scoped = scoped.eq("user_id", onlyUser);
    scoped = scoped.order("created_at", { ascending: true });
  } else {
    scoped = scoped.in("id", explicitIds);
  }
  const { data: rows, error } = await scoped;
  if (error) {
    console.error("Failed to read content:", error.message);
    process.exit(1);
  }

  const candidates = explicitIds.length
    ? rows
    : rows.filter((row) => {
    // Nothing to re-derive from if the source is gone.
    if (!row.tiktok_url) return false;
    if (all) return true;
    // Meals need plants; drinks only gained equipment.
    const data = row.data ?? {};
    return row.category === "meal"
      ? typeof data.effort !== "string"
      : !Array.isArray(data.equipment) || data.equipment.length === 0;
      });

  const isEdited = (row) =>
    typeof (row.data ?? {}).manually_edited_at === "string";
  const edited = candidates.filter(isEdited);
  const targets = (skipEdited ? candidates.filter((r) => !isEdited(r)) : candidates)
    .slice(0, limit || undefined);

  // Phone numbers live on the users table and the session needs one.
  const userIds = [...new Set(targets.map((row) => row.user_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, phone_number")
    .in("id", userIds);
  const phoneById = new Map((users ?? []).map((u) => [u.id, u.phone_number]));

  console.log(`Recipes found      : ${rows.length}`);
  console.log(
    `${all || explicitIds.length ? "Candidates         " : "Missing attributes "}: ${candidates.length}`
  );
  console.log(
    `Hand-edited        : ${edited.length}${
      skipEdited ? " (skipping)" : " (WILL BE OVERWRITTEN)"
    }`
  );
  console.log(`Will re-process    : ${targets.length}`);
  console.log(`Mode               : ${apply ? "APPLY" : "dry run"}`);
  if (onlyUser) console.log(`Scoped to user     : ${onlyUser}`);
  if (onlyCategory) console.log(`Scoped to category : ${onlyCategory}`);
  console.log("");

  if (edited.length > 0 && !skipEdited) {
    for (const row of edited) {
      console.log(`  hand-edited: ${row.title} (${row.id})`);
    }
    console.log("");
  }

  if (!apply) {
    for (const row of targets) {
      console.log(`  would re-process: [${row.category}] ${row.title}`);
    }
    console.log("\nDry run — pass --apply to actually re-process.");
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const [index, row] of targets.entries()) {
    const phone = phoneById.get(row.user_id);
    if (!phone) {
      console.warn(`  ! no phone for user ${row.user_id}, skipping ${row.id}`);
      failed++;
      continue;
    }

    const label = `[${index + 1}/${targets.length}] ${row.title}`;
    try {
      const res = await fetch(`${baseUrl}/api/content/${row.id}/reprocess`, {
        method: "POST",
        headers: {
          Cookie: `session=${mintSession(row.user_id, phone)}`,
        },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`  ✗ ${label} — ${res.status} ${body.slice(0, 120)}`);
        failed++;
      } else {
        console.log(`  ✓ ${label}`);
        ok++;
      }
    } catch (err) {
      console.error(`  ✗ ${label} — ${err.message}`);
      failed++;
    }

    // Reprocess kicks off async work; spacing the calls keeps a backfill from
    // stampeding Gemini and the scraper all at once.
    if (index < targets.length - 1) await sleep(delayMs);
  }

  console.log(`\nQueued ${ok}, failed ${failed}.`);
  console.log(
    "Re-processing runs in the background — re-run with no --apply in a few minutes to see what is still missing."
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
