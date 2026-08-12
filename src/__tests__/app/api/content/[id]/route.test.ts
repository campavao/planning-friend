/**
 * PATCH /api/content/[id] used to write whatever arrived in `data` straight
 * into the JSONB column. These tests are about what reaches the row: what a
 * client sends, what the route decides to write, and what a later GET hands
 * back. The store below merges exactly the keys it is given, so anything that
 * goes missing went missing in the route.
 */

import { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const mockRows = new Map<string, Row>();
const mockUpdateCalls: { id: string; updates: Row }[] = [];
let mockUserId = "owner-1";

jest.mock("@/lib/auth", () => ({
  requireSession: jest.fn(async () => ({
    session: { userId: mockUserId, phoneNumber: "+15550001111", exp: 0 },
    errorResponse: null,
  })),
  getSession: jest.fn(async () => ({
    userId: mockUserId,
    phoneNumber: "+15550001111",
    exp: 0,
  })),
}));

jest.mock("@/lib/supabase", () => ({
  getContentById: jest.fn(async (id: string) => mockRows.get(id) ?? null),
  updateContent: jest.fn(async (id: string, updates: Row) => {
    mockUpdateCalls.push({ id, updates });
    const next = { ...(mockRows.get(id) ?? {}), ...updates };
    mockRows.set(id, next);
    return next;
  }),
  getContentTags: jest.fn(async () => []),
  getUserById: jest.fn(async () => null),
  deleteContent: jest.fn(async () => undefined),
  deleteThumbnail: jest.fn(async () => undefined),
}));

import { GET, PATCH } from "@/app/api/content/[id]/route";
import { MANUAL_EDIT_STAMP_KEY } from "@/lib/schemas/content";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";

const STORED_MEAL = {
  ingredients: ["2 cups flour", "1 tsp salt", "3 eggs"],
  recipe: ["Mix the dry ingredients", "Bake for 40 minutes"],
  prep_time: "15 min",
  cook_time: "40 min",
  servings: "4",
  source_notes: "left behind by an older extraction",
};

function seedItem(overrides: Row = {}) {
  mockRows.set(ITEM_ID, {
    id: ITEM_ID,
    user_id: "owner-1",
    title: "Banana bread",
    category: "meal",
    status: "completed",
    tiktok_url: "https://example.com/video",
    data: { ...STORED_MEAL },
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

const params = Promise.resolve({ id: ITEM_ID });

function patch(body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/content/${ITEM_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  );
}

function get() {
  return GET(
    new NextRequest(`http://localhost/api/content/${ITEM_ID}`),
    { params }
  );
}

function storedData(): Row {
  return mockRows.get(ITEM_ID)?.data as Row;
}

beforeEach(() => {
  mockRows.clear();
  mockUpdateCalls.length = 0;
  mockUserId = "owner-1";
  seedItem();
});

describe("PATCH /api/content/[id] — saving a data edit", () => {
  it("writes the edited ingredients and leaves the rest of the blob alone", async () => {
    const ingredients = ["3 eggs", "2 cups flour", "1 tsp fine salt"];

    const res = await patch({ data: { ingredients } });
    expect(res.status).toBe(200);

    expect(storedData()).toEqual({
      ...STORED_MEAL,
      ingredients,
      [MANUAL_EDIT_STAMP_KEY]: expect.any(String),
    });
  });

  it("does not touch prep_time when the save was about the ingredients", async () => {
    await patch({ data: { ingredients: ["water"] } });

    expect(storedData().prep_time).toBe("15 min");
    expect(storedData().cook_time).toBe("40 min");
    expect(storedData().servings).toBe("4");
  });

  it("removes a field the user blanked, and nothing else", async () => {
    await patch({ data: { prep_time: "" } });

    expect(MANUAL_EDIT_STAMP_KEY in storedData()).toBe(true);
    expect("prep_time" in storedData()).toBe(false);
    expect(storedData().cook_time).toBe("40 min");
  });

  it("stamps the blob so a later re-process can warn about the edit", async () => {
    await patch({ data: { servings: "6" } });

    expect(typeof storedData()[MANUAL_EDIT_STAMP_KEY]).toBe("string");
  });

  it("leaves data out of the update when the patch is empty", async () => {
    await patch({ title: "Banana bread", data: {} });

    expect(mockUpdateCalls).toHaveLength(1);
    expect("data" in mockUpdateCalls[0].updates).toBe(false);
  });

  it("saves the title and category alongside the data", async () => {
    await patch({
      title: "Banana loaf",
      category: "drink",
      data: { type: "smoothie" },
    });

    expect(mockRows.get(ITEM_ID)).toMatchObject({
      title: "Banana loaf",
      category: "drink",
    });
    // Re-categorising keeps what was extracted: the ingredients still mean what
    // they meant, and cook_time is there again if the user switches back.
    expect(storedData()).toMatchObject({
      ...STORED_MEAL,
      type: "smoothie",
    });
  });
});

describe("PATCH /api/content/[id] — rejections", () => {
  it("rejects a list sent as a string without writing anything", async () => {
    const res = await patch({ data: { ingredients: "flour" } });

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
    expect(storedData()).toEqual(STORED_MEAL);
  });

  it("rejects a value outside a select's options", async () => {
    seedItem({ category: "date_idea", data: { location: "Chicago" } });

    const res = await patch({ data: { price_range: "cheap" } });

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("rejects a javascript: link", async () => {
    seedItem({ category: "date_idea", data: { location: "Chicago" } });

    const res = await patch({ data: { website: "javascript:alert(1)" } });

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("rejects an empty title", async () => {
    const res = await patch({ title: "   " });

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("rejects a category it has never heard of", async () => {
    const res = await patch({ category: "brunch" });

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("answers 400, not 500, for a body that is not JSON", async () => {
    const res = await PATCH(
      new NextRequest(`http://localhost/api/content/${ITEM_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      }),
      { params }
    );

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("says which field it objected to", async () => {
    const res = await patch({ data: { ingredients: [1, 2] } });
    const body = await res.json();

    expect(body.error).toContain("ingredients");
  });
});

describe("PATCH /api/content/[id] — ownership", () => {
  it("refuses a signed-in stranger and writes nothing", async () => {
    mockUserId = "someone-else";

    const res = await patch({ data: { ingredients: ["nothing good"] } });

    expect(res.status).toBe(401);
    expect(mockUpdateCalls).toHaveLength(0);
    expect(storedData()).toEqual(STORED_MEAL);
  });
});

describe("PATCH /api/content/[id] — starring", () => {
  it("stars without going anywhere near the data blob", async () => {
    await patch({ is_favorite: true });

    expect(mockUpdateCalls[0].updates).toEqual({ is_favorite: true });
    expect(storedData()).toEqual(STORED_MEAL);
  });

  it("rejects a star that is not a boolean", async () => {
    const res = await patch({ is_favorite: "yes" });

    expect(res.status).toBe(400);
    expect(mockUpdateCalls).toHaveLength(0);
  });
});

describe("GET /api/content/[id] after an edit", () => {
  it("hands back the edited item, so a reload shows the edit", async () => {
    const recipe = ["Mix", "Bake", "Cool on a rack"];
    await patch({ data: { recipe } });

    const body = await (await get()).json();

    expect(body.content.data.recipe).toEqual(recipe);
    expect(body.content.data.prep_time).toBe("15 min");
    expect(body.content.data.source_notes).toBe(
      "left behind by an older extraction"
    );
  });

  it("survives a second edit to a different field", async () => {
    await patch({ data: { ingredients: ["3 eggs"] } });
    await patch({ data: { servings: "2" } });

    const body = await (await get()).json();

    expect(body.content.data).toMatchObject({
      ingredients: ["3 eggs"],
      servings: "2",
      cook_time: "40 min",
    });
  });
});
