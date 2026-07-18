/**
 * Regression tests for the Twilio webhook signature URL derivation.
 *
 * Twilio signs the EXACT URL configured in its console — the public domain the
 * request arrived on. Validating against process.env.VERCEL_URL (the
 * per-deployment *-<hash>.vercel.app host) rejected every real webhook in
 * production for 12 days. These tests lock in that the public host from
 * x-forwarded-host is always among the candidates and that a signature
 * computed over the console URL validates end-to-end.
 */
import {
  getWebhookUrlCandidates,
  validateTwilioRequest,
} from "@/lib/twilio";
import { NextRequest } from "next/server";
import twilio from "twilio";

const CONSOLE_URL = "https://tiktok-helper.vercel.app/api/twilio/webhook";
const DEPLOY_URL = "tiktok-helper-abc123-campavaos-projects.vercel.app";

function vercelStyleRequest(): NextRequest {
  // On Vercel the function sees the deployment URL internally while the
  // public host the caller hit is carried in x-forwarded-host/proto.
  return new NextRequest(`https://${DEPLOY_URL}/api/twilio/webhook`, {
    method: "POST",
    headers: {
      host: DEPLOY_URL,
      "x-forwarded-host": "tiktok-helper.vercel.app",
      "x-forwarded-proto": "https",
    },
  });
}

const ENV_KEYS = [
  "TWILIO_WEBHOOK_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
  "TWILIO_AUTH_TOKEN",
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("getWebhookUrlCandidates", () => {
  it("includes the public URL from x-forwarded-host even when VERCEL_URL is set", () => {
    process.env.VERCEL_URL = DEPLOY_URL;
    const candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(candidates).toContain(CONSOLE_URL);
  });

  it("prefers the forwarded-host URL over the VERCEL_URL derivation", () => {
    process.env.VERCEL_URL = DEPLOY_URL;
    const candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(candidates.indexOf(CONSOLE_URL)).toBeLessThan(
      candidates.indexOf(`https://${DEPLOY_URL}/api/twilio/webhook`)
    );
  });

  it("puts an explicit TWILIO_WEBHOOK_URL override first", () => {
    process.env.TWILIO_WEBHOOK_URL = "https://example.com/api/twilio/webhook";
    const candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(candidates[0]).toBe("https://example.com/api/twilio/webhook");
  });

  it("includes NEXT_PUBLIC_APP_URL (trailing slash trimmed) but ignores localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://myapp.example.com/";
    let candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(candidates).toContain(
      "https://myapp.example.com/api/twilio/webhook"
    );

    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(candidates).not.toContain(
      "http://localhost:3000/api/twilio/webhook"
    );
  });
});

describe("signature validation against candidates", () => {
  it("a signature computed over the console URL validates via the candidate list", () => {
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    process.env.VERCEL_URL = DEPLOY_URL;

    const params = { From: "+15551234567", Body: "https://vm.tiktok.com/x/" };
    const signature = twilio.getExpectedTwilioSignature(
      "test-auth-token",
      CONSOLE_URL,
      params
    );

    const candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(
      candidates.some((url) => validateTwilioRequest(signature, url, params))
    ).toBe(true);
  });

  it("a bad signature validates against no candidate", () => {
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    process.env.VERCEL_URL = DEPLOY_URL;

    const params = { From: "+15551234567", Body: "hello" };
    const candidates = getWebhookUrlCandidates(vercelStyleRequest());
    expect(
      candidates.some((url) =>
        validateTwilioRequest("bogus-signature", url, params)
      )
    ).toBe(false);
  });
});
