/**
 * The send-code gate. This endpoint is public and every call that reaches
 * Twilio costs money, so these pin the two things that stopped an SMS-pumping
 * run: non-+1 numbers never reach Twilio, and the rate limits refuse in order
 * without spending later budgets.
 */

import { NextRequest } from "next/server";

const mockHits = new Map<string, number>();
const mockSendPhoneOtp = jest.fn<Promise<void>, [string]>(async () => {});

jest.mock("@/lib/supabase", () => ({
  sendPhoneOtp: (phone: string) => mockSendPhoneOtp(phone),
  normalizePhoneNumber: jest.requireActual("@/lib/phone").normalizePhoneNumber,
}));

jest.mock("@/lib/db/client", () => ({
  createServerClient: () => ({
    rpc: async (_fn: string, args: { p_key: string }) => {
      const hits = (mockHits.get(args.p_key) ?? 0) + 1;
      mockHits.set(args.p_key, hits);
      return { data: hits, error: null };
    },
  }),
}));

import { POST } from "@/app/api/auth/send-code/route";

function send(phoneNumber: string, ip = "203.0.113.7") {
  return POST(
    new NextRequest("http://localhost/api/auth/send-code", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify({ phoneNumber }),
    })
  );
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

beforeEach(() => {
  mockHits.clear();
  mockSendPhoneOtp.mockClear();
});

it("sends to a US number", async () => {
  const res = await send("(555) 123-4567");
  expect(res.status).toBe(200);
  expect(mockSendPhoneOtp).toHaveBeenCalledWith("+15551234567");
});

it("refuses international numbers before Twilio or the limiter", async () => {
  const res = await send("+50212345678");
  expect(res.status).toBe(400);
  expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  expect(mockHits.size).toBe(0);
});

it("limits one IP to 5 sends an hour", async () => {
  for (let i = 0; i < 5; i++) {
    expect((await send(`+1555000000${i}`)).status).toBe(200);
  }
  const res = await send("+15550000009");
  expect(res.status).toBe(429);
  expect(mockSendPhoneOtp).toHaveBeenCalledTimes(5);
  // The refused request did not spend that number's or the global budget.
  expect(mockHits.get("send-code:phone:+15550000009")).toBeUndefined();
  expect(mockHits.get("send-code:global")).toBe(5);
});

it("limits one phone number across IPs", async () => {
  for (let i = 0; i < 5; i++) {
    expect((await send("+15551234567", `198.51.100.${i}`)).status).toBe(200);
  }
  expect((await send("+15551234567", "198.51.100.99")).status).toBe(429);
});

it("caps total sends per day across IPs and numbers", async () => {
  for (let i = 0; i < 50; i++) {
    const n = String(i).padStart(2, "0");
    expect((await send(`+155500000${n}`, `198.51.100.${i}`)).status).toBe(200);
  }
  expect((await send("+15559999999", "192.0.2.1")).status).toBe(429);
  expect(mockSendPhoneOtp).toHaveBeenCalledTimes(50);
});
