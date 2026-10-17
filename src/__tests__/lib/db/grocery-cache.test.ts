/**
 * grocery_list_cache now holds the user's check-offs, so the cache layer must
 * never throw the row away: invalidation forces a regeneration (which carries
 * ticks over) and a failed read must not look like "no list yet".
 */

type Call = { table: string; op: string; args: unknown[]; filters: [string, unknown][] };
const mockCalls: Call[] = [];
let mockResult: { data: unknown; error: unknown } = { data: null, error: null };

jest.mock("@/lib/db/client", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      const call: Call = { table, op: "", args: [], filters: [] };
      mockCalls.push(call);
      const builder = {
        select: (...args: unknown[]) => ((call.op ||= "select"), builder),
        update: (...args: unknown[]) => ((call.op = "update"), (call.args = args), builder),
        delete: (...args: unknown[]) => ((call.op = "delete"), (call.args = args), builder),
        eq: (col: string, val: unknown) => (call.filters.push([col, val]), builder),
        single: async () => mockResult,
        then: (resolve: (v: unknown) => unknown) => resolve(mockResult),
      };
      return builder;
    },
  }),
}));

import { clearGroceryListCache, getGroceryListCache } from "@/lib/db/grocery-cache";

beforeEach(() => {
  mockCalls.length = 0;
  mockResult = { data: null, error: null };
});

describe("clearGroceryListCache", () => {
  it("empties the cache key instead of deleting the row and its check-offs", async () => {
    await clearGroceryListCache("user-1");
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0].op).toBe("update");
    expect(mockCalls[0].args[0]).toEqual({ recipe_ids: [] });
    expect(mockCalls[0].filters).toEqual([["user_id", "user-1"]]);
  });
});

describe("getGroceryListCache", () => {
  it("returns null when the week has no row", async () => {
    mockResult = { data: null, error: { code: "PGRST116", message: "no rows" } };
    await expect(getGroceryListCache("user-1", "2026-10-11")).resolves.toBeNull();
  });

  it("throws on a real read error so the caller cannot overwrite the row", async () => {
    mockResult = { data: null, error: { code: "08006", message: "connection failure" } };
    await expect(getGroceryListCache("user-1", "2026-10-11")).rejects.toThrow(
      /connection failure/,
    );
  });
});
