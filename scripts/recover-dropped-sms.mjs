#!/usr/bin/env node
/**
 * Replay inbound Twilio messages through the webhook.
 *
 * Use case: the webhook rejected real texts for a period (e.g. the July 2026
 * signature-URL mismatch), so the links people texted in were never ingested.
 * Twilio retains the messages (and MMS media) — this script lists inbound
 * messages in a window and re-POSTs each to the webhook as a correctly signed
 * Twilio-style request, so they flow through the normal pipeline.
 *
 * The webhook is idempotent-enough for this use: messages with no link and no
 * image are ACKed without writing anything, so replaying the whole window is
 * safe for those. Messages WITH a link create a new content row — only replay
 * a window you know was dropped (check the newest content row's created_at).
 *
 * Usage:
 *   TWILIO_ACCOUNT_SID=ACxxx TWILIO_AUTH_TOKEN=xxx \
 *   node scripts/recover-dropped-sms.mjs --since 2026-07-06T04:29:00Z [--dry-run]
 *
 * Options:
 *   --since <ISO date>   Only replay messages sent after this time (required)
 *   --url <webhook url>  Webhook to replay against
 *                        (default https://tiktok-helper.vercel.app/api/twilio/webhook)
 *   --dry-run            List what would be replayed without sending anything
 */
import crypto from "crypto";

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
if (!SID || !TOKEN) {
  console.error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.");
  process.exit(2);
}

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const since = getArg("--since");
const webhookUrl =
  getArg("--url") ?? "https://tiktok-helper.vercel.app/api/twilio/webhook";
const dryRun = args.includes("--dry-run");

if (!since || Number.isNaN(Date.parse(since))) {
  console.error("--since <ISO date> is required (e.g. --since 2026-07-06T04:29:00Z)");
  process.exit(2);
}

const twilioApi = `https://api.twilio.com/2010-04-01/Accounts/${SID}`;
const auth = "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");

async function twilioGet(path) {
  const res = await fetch(`${twilioApi}${path}`, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`Twilio API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Twilio signature: base64(HMAC-SHA1(authToken, url + sortedKey1val1key2val2...))
function signParams(url, params) {
  const sorted = Object.keys(params).sort().map((k) => k + params[k]).join("");
  return crypto.createHmac("sha1", TOKEN).update(url + sorted).digest("base64");
}

async function main() {
  const sinceDate = new Date(since);
  // Twilio's DateSent filter is day-granular; fetch the day and filter exactly.
  const day = since.slice(0, 10);
  const data = await twilioGet(
    `/Messages.json?DateSent%3E=${day}&PageSize=200`
  );

  const inbound = (data.messages ?? [])
    .filter((m) => m.direction === "inbound")
    .filter((m) => new Date(m.date_sent) > sinceDate)
    .sort((a, b) => new Date(a.date_sent) - new Date(b.date_sent));

  console.log(`${inbound.length} inbound message(s) after ${since}\n`);

  let ok = 0, failed = 0;
  for (const m of inbound) {
    const params = {
      MessageSid: m.sid,
      AccountSid: SID,
      From: m.from,
      To: m.to,
      Body: m.body ?? "",
      NumMedia: String(m.num_media ?? "0"),
    };

    if (Number(m.num_media) > 0) {
      const media = await twilioGet(`/Messages/${m.sid}/Media.json`);
      (media.media_list ?? []).forEach((item, i) => {
        params[`MediaUrl${i}`] = `https://api.twilio.com${item.uri.replace(/\.json$/, "")}`;
        params[`MediaContentType${i}`] = item.content_type;
      });
    }

    const label = `${m.date_sent}  ${m.from}  ${m.num_media > 0 ? `[${m.num_media} media]` : ""} ${(m.body || "").slice(0, 60)}`;
    if (dryRun) {
      console.log(`DRY   ${label}`);
      continue;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signParams(webhookUrl, params),
      },
      body: new URLSearchParams(params).toString(),
    });
    const good = res.status === 200;
    good ? ok++ : failed++;
    console.log(`${good ? "SENT" : `FAIL ${res.status}`}  ${label}`);
    // Space out replays so async processing (Gemini etc.) isn't hammered.
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (!dryRun) console.log(`\n${ok} replayed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
