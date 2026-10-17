/**
 * The grocery list route against an in-memory cache row and a fake model.
 * The row store merges exactly what the route hands it, so these tests see
 * what a later reader of grocery_list_cache would see.
 */

import { NextRequest } from "next/server";
import { normalizeCachedItems } from "@/lib/grocery-list";

type Row = { recipe_ids: string[]; items: unknown[]; tips: string[] };
const mockRows = new Map<string, Row>();
const mockGenerate = jest.fn();

jest.mock("@/lib/auth", () => ({
  requireSession: jest.fn(async () => ({
    session: { userId: "user-1", phoneNumber: "+15550001111", exp: Date.now() + 1000 },
    errorResponse: null,
  })),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerate },
  })),
}));

jest.mock("@/lib/supabase", () => ({
  getGroceryListCache: jest.fn(async (userId: string, weekStart: string) => {
    const row = mockRows.get(`${userId}|${weekStart}`);
    return row ? { ...row, items: normalizeCachedItems(row.items) } : null;
  }),
  upsertGroceryListCache: jest.fn(
    async (userId: string, weekStart: string, recipeIds: string[], items: unknown[], tips: string[]) => {
      mockRows.set(`${userId}|${weekStart}`, { recipe_ids: recipeIds, items, tips });
    }
  ),
  updateGroceryListItems: jest.fn(
    async (userId: string, weekStart: string, items: unknown[]) => {
      const row = mockRows.get(`${userId}|${weekStart}`)!;
      mockRows.set(`${userId}|${weekStart}`, { ...row, items });
    }
  ),
}));

import { PATCH, POST } from "@/app/api/planner/grocery-list/route";

const WEEK = "2026-10-11";
const row = () => mockRows.get(`user-1|${WEEK}`)!;

function call(method: "POST" | "PATCH", body: unknown) {
  const req = new NextRequest("http://localhost/api/planner/grocery-list", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return method === "POST" ? POST(req) : PATCH(req);
}

const pasta = {
  id: "content-pasta",
  title: "Pasta Bolognese",
  category: "meal",
  ingredients: ["1 lb ground beef", "1 onion", "olive oil"],
};
const steak = { id: "plan-item-1", title: "Steak & veggies" };
const iowa = { id: "plan-item-2", title: "Iowa" };

function modelReturns(items: unknown[]) {
  mockGenerate.mockResolvedValueOnce({ text: JSON.stringify({ items, tips: [] }) });
}

const pastaAndSteakList = [
  {
    ingredient: "Ground beef",
    quantity: "1 lb",
    category: "Meat & Seafood",
    sources: [{ id: "content-pasta", title: "Pasta Bolognese" }],
  },
  {
    ingredient: "Ribeye steak",
    quantity: "2",
    category: "Meat & Seafood",
    sources: [{ id: "plan-item-1", title: "Steak & veggies" }],
  },
  {
    ingredient: "Olive oil",
    category: "Pantry",
    staple: true,
    sources: [{ id: "content-pasta", title: "Pasta Bolognese" }],
  },
];

beforeAll(() => {
  process.env.GOOGLE_AI_API_KEY = "test-key";
});

beforeEach(() => {
  mockRows.clear();
  mockGenerate.mockReset();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("POST /api/planner/grocery-list", () => {
  it("sends quick notes to the model and stores the flagged list", async () => {
    modelReturns(pastaAndSteakList);

    const res = await call("POST", { recipes: [pasta], notes: [steak, iowa], weekStart: WEEK });
    expect(res.status).toBe(200);

    const prompt = mockGenerate.mock.calls[0][0].contents as string;
    expect(prompt).toContain("ID: plan-item-1 | Note: Steak & veggies");
    expect(prompt).toContain("ID: plan-item-2 | Note: Iowa");

    const stored = row();
    expect(stored.recipe_ids).toEqual([
      "content-pasta",
      "note:iowa",
      "note:steak & veggies",
    ]);
    expect(stored.items).toEqual([
      {
        ingredient: "Ground beef",
        quantity: "1 lb",
        category: "Meat & Seafood",
        sources: [{ id: "content-pasta", title: "Pasta Bolognese", kind: "recipe" }],
        notes: undefined,
        estimated: false,
        staple: false,
        checked: false,
      },
      {
        ingredient: "Ribeye steak",
        quantity: "2",
        category: "Meat & Seafood",
        sources: [{ id: "plan-item-1", title: "Steak & veggies", kind: "note" }],
        notes: undefined,
        estimated: true,
        staple: false,
        checked: false,
      },
      {
        ingredient: "Olive oil",
        quantity: undefined,
        category: "Pantry",
        sources: [{ id: "content-pasta", title: "Pasta Bolognese", kind: "recipe" }],
        notes: undefined,
        estimated: false,
        staple: true,
        checked: false,
      },
    ]);
    expect((await res.json()).items).toEqual(JSON.parse(JSON.stringify(stored.items)));
  });

  it("generates a list for a week of quick notes alone", async () => {
    modelReturns([pastaAndSteakList[1]]);
    const res = await call("POST", { notes: [steak], weekStart: WEEK });
    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("rejects a week with neither recipes nor notes", async () => {
    const res = await call("POST", {
      recipes: [{ ...pasta, ingredients: [] }],
      notes: [{ id: "x", title: "  " }],
      weekStart: WEEK,
    });
    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("serves the cache while the recipes and notes are unchanged", async () => {
    modelReturns(pastaAndSteakList);
    await call("POST", { recipes: [pasta], notes: [steak], weekStart: WEEK });

    const res = await call("POST", { recipes: [pasta], notes: [steak], weekStart: WEEK });
    expect((await res.json()).cached).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when a quick note changes and keeps check-offs", async () => {
    modelReturns(pastaAndSteakList);
    await call("POST", { recipes: [pasta], notes: [steak], weekStart: WEEK });
    await call("PATCH", { weekStart: WEEK, checked: ["Ground beef"] });

    modelReturns([pastaAndSteakList[0]]);
    const res = await call("POST", {
      recipes: [pasta],
      notes: [{ ...steak, title: "Bok choy" }],
      weekStart: WEEK,
    });
    const body = await res.json();
    expect(body.cached).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(body.items[0]).toMatchObject({ ingredient: "Ground beef", checked: true });
    expect(row().recipe_ids).toEqual(["content-pasta", "note:bok choy"]);
  });

  it("returns 500 without caching when the model reply has no list", async () => {
    mockGenerate.mockResolvedValueOnce({ text: "I can't do that" });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await call("POST", { recipes: [pasta], weekStart: WEEK });
    expect(res.status).toBe(500);
    expect(mockRows.size).toBe(0);
  });
});

describe("PATCH /api/planner/grocery-list", () => {
  beforeEach(async () => {
    modelReturns(pastaAndSteakList);
    await call("POST", { recipes: [pasta], notes: [steak], weekStart: WEEK });
  });

  const checkedNames = () =>
    (row().items as { ingredient: string; checked: boolean }[])
      .filter((i) => i.checked)
      .map((i) => i.ingredient);

  it("stores the checked set and is safe to repeat", async () => {
    const first = await call("PATCH", { weekStart: WEEK, checked: ["ribeye steak", "Olive oil"] });
    expect(first.status).toBe(200);
    expect(checkedNames()).toEqual(["Ribeye steak", "Olive oil"]);

    await call("PATCH", { weekStart: WEEK, checked: ["ribeye steak", "Olive oil"] });
    expect(checkedNames()).toEqual(["Ribeye steak", "Olive oil"]);

    await call("PATCH", { weekStart: WEEK, checked: [] });
    expect(checkedNames()).toEqual([]);
  });

  it("leaves the cache key and tips alone, so the next open is still a cache hit", async () => {
    await call("PATCH", { weekStart: WEEK, checked: ["Ground beef"] });
    const res = await call("POST", { recipes: [pasta], notes: [steak], weekStart: WEEK });
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.items[0]).toMatchObject({ ingredient: "Ground beef", checked: true });
  });

  it("rejects a malformed body", async () => {
    expect((await call("PATCH", { weekStart: WEEK, checked: "Onions" })).status).toBe(400);
    expect((await call("PATCH", { checked: [] })).status).toBe(400);
  });

  it("returns 404 for a week with no list", async () => {
    const res = await call("PATCH", { weekStart: "2026-01-04", checked: [] });
    expect(res.status).toBe(404);
  });
});
