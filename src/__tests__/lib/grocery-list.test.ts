import {
  applyChecked,
  buildGroceryPrompt,
  cacheKeysMatch,
  carryOverChecked,
  groceryCacheKey,
  groceryLine,
  groupByAisle,
  normalizeCachedItems,
  parseGroceryResponse,
  type GroceryItem,
  type QuickNoteInput,
  type RecipeInput,
} from "@/lib/grocery-list";

const pasta: RecipeInput = {
  id: "content-pasta",
  title: "Pasta Bolognese",
  category: "meal",
  ingredients: ["1 lb ground beef", "1 onion", "2 tbsp olive oil"],
};
const steakNote: QuickNoteInput = { id: "plan-item-1", title: "Steak & veggies" };
const iowaNote: QuickNoteInput = { id: "plan-item-2", title: "Iowa" };

function item(overrides: Partial<GroceryItem>): GroceryItem {
  return {
    ingredient: "Onions",
    category: "Produce",
    sources: [],
    estimated: false,
    staple: false,
    checked: false,
    ...overrides,
  };
}

describe("buildGroceryPrompt", () => {
  it("sends recipe ingredients and quick-note titles with their ids", () => {
    const prompt = buildGroceryPrompt([pasta], [steakNote, iowaNote]);
    expect(prompt).toContain("ID: content-pasta");
    expect(prompt).toContain("- 1 lb ground beef");
    expect(prompt).toContain("ID: plan-item-1 | Note: Steak & veggies");
    expect(prompt).toContain("ID: plan-item-2 | Note: Iowa");
  });

  it("leaves the recipes section out of a notes-only week", () => {
    const prompt = buildGroceryPrompt([], [steakNote]);
    expect(prompt).not.toContain("Here are the recipes:");
    expect(prompt).toContain("Here are the quick notes:");
  });
});

describe("groceryCacheKey", () => {
  it("ignores order", () => {
    const a = groceryCacheKey([pasta], [steakNote, iowaNote]);
    const b = groceryCacheKey([pasta], [iowaNote, steakNote]);
    expect(cacheKeysMatch(a, b)).toBe(true);
  });

  it("changes when a quick note is added, renamed or removed", () => {
    const base = groceryCacheKey([pasta], [steakNote]);
    expect(cacheKeysMatch(base, groceryCacheKey([pasta], []))).toBe(false);
    expect(
      cacheKeysMatch(base, groceryCacheKey([pasta], [steakNote, iowaNote])),
    ).toBe(false);
    expect(
      cacheKeysMatch(
        base,
        groceryCacheKey([pasta], [{ ...steakNote, title: "Steak & rice" }]),
      ),
    ).toBe(false);
  });

  it("does not change when only the note's case or spacing changes", () => {
    const base = groceryCacheKey([], [steakNote]);
    const retyped = groceryCacheKey([], [{ ...steakNote, title: " steak &  veggies " }]);
    expect(cacheKeysMatch(base, retyped)).toBe(true);
  });

  it("matches a legacy key made of recipe ids alone when the week has no notes", () => {
    expect(cacheKeysMatch(["content-pasta"], groceryCacheKey([pasta], []))).toBe(true);
  });
});

describe("parseGroceryResponse", () => {
  const reply = (items: unknown[], tips?: unknown) =>
    "```json\n" + JSON.stringify({ items, tips }) + "\n```";

  it("marks items that come only from quick notes as estimated", () => {
    const parsed = parseGroceryResponse(
      reply([
        {
          ingredient: "Ribeye steak",
          quantity: "2",
          category: "Meat & Seafood",
          sources: [{ id: "plan-item-1", title: "whatever" }],
        },
        {
          ingredient: "Onions",
          category: "Produce",
          sources: [
            { id: "content-pasta", title: "Pasta Bolognese" },
            { id: "plan-item-1", title: "Steak & veggies" },
          ],
        },
      ]),
      [pasta],
      [steakNote],
    );

    const byName = Object.fromEntries(parsed!.items.map((i) => [i.ingredient, i]));
    expect(byName["Ribeye steak"].estimated).toBe(true);
    expect(byName["Ribeye steak"].sources).toEqual([
      { id: "plan-item-1", title: "Steak & veggies", kind: "note" },
    ]);
    expect(byName["Onions"].estimated).toBe(false);
  });

  it("drops sources the model made up", () => {
    const parsed = parseGroceryResponse(
      reply([
        {
          ingredient: "Garlic",
          category: "Produce",
          sources: [{ id: "invented", title: "Garlic bread" }],
        },
      ]),
      [pasta],
      [],
    );
    expect(parsed!.items[0].sources).toEqual([]);
    expect(parsed!.items[0].estimated).toBe(false);
  });

  it("flags staples from the model and from the known list", () => {
    const parsed = parseGroceryResponse(
      reply([
        { ingredient: "Olive oil", category: "Pantry", sources: [] },
        { ingredient: "Smoked paprika", category: "Spices & Seasonings", staple: true, sources: [] },
        { ingredient: "Ground beef", category: "Meat & Seafood", sources: [] },
      ]),
      [pasta],
      [],
    );
    const staples = parsed!.items.filter((i) => i.staple).map((i) => i.ingredient);
    expect(staples.sort()).toEqual(["Olive oil", "Smoked paprika"]);
  });

  it("trusts the model's explicit staple: false over the known list", () => {
    // Flour bought for a bread recipe must not be hidden from the list and image.
    const parsed = parseGroceryResponse(
      reply([
        { ingredient: "Flour", quantity: "6 cups", category: "Pantry", staple: false, sources: [] },
        { ingredient: "Salt", category: "Spices & Seasonings", sources: [] },
      ]),
      [pasta],
      [],
    );
    expect(parsed!.items.map((i) => [i.ingredient, i.staple])).toEqual([
      ["Flour", false],
      ["Salt", true],
    ]);
  });

  it("sorts by aisle and maps unknown categories to Other", () => {
    const parsed = parseGroceryResponse(
      reply([
        { ingredient: "Ice cream", category: "Frozen", sources: [] },
        { ingredient: "Paper towels", category: "Household", sources: [] },
        { ingredient: "Basil", category: "produce", sources: [] },
      ]),
      [],
      [steakNote],
    );
    expect(parsed!.items.map((i) => [i.ingredient, i.category])).toEqual([
      ["Basil", "Produce"],
      ["Ice cream", "Frozen"],
      ["Paper towels", "Other"],
    ]);
  });

  it("starts every item unchecked and keeps only string tips", () => {
    const parsed = parseGroceryResponse(
      reply([{ ingredient: "Rice", category: "Pantry", checked: true, sources: [] }], [
        "Buy rice in bulk",
        42,
      ]),
      [],
      [steakNote],
    );
    expect(parsed!.items[0].checked).toBe(false);
    expect(parsed!.tips).toEqual(["Buy rice in bulk"]);
  });

  it("returns null for a reply without an item list", () => {
    expect(parseGroceryResponse("Sorry, I can't help", [pasta], [])).toBeNull();
    expect(parseGroceryResponse('{"items": "none"}', [pasta], [])).toBeNull();
    expect(parseGroceryResponse("{not json}", [pasta], [])).toBeNull();
  });
});

describe("normalizeCachedItems", () => {
  it("fills in flags a pre-upgrade cached row lacks", () => {
    const items = normalizeCachedItems([
      {
        ingredient: "Salt",
        category: "Spices & Seasonings",
        sources: [{ id: "content-pasta", title: "Pasta Bolognese" }],
      },
    ]);
    expect(items).toEqual([
      {
        ingredient: "Salt",
        quantity: undefined,
        notes: undefined,
        category: "Spices & Seasonings",
        sources: [{ id: "content-pasta", title: "Pasta Bolognese", kind: "recipe" }],
        estimated: false,
        staple: true,
        checked: false,
      },
    ]);
  });

  it("keeps stored flags", () => {
    const [stored] = normalizeCachedItems([
      {
        ingredient: "Bok choy",
        category: "Produce",
        sources: [{ id: "plan-item-3", title: "Bok choy", kind: "note" }],
        estimated: true,
        checked: true,
      },
    ]);
    expect(stored).toMatchObject({ estimated: true, checked: true, staple: false });
    expect(stored.sources[0].kind).toBe("note");
  });
});

describe("check-offs", () => {
  const list = [
    item({ ingredient: "Onions" }),
    item({ ingredient: "Ground beef", category: "Meat & Seafood" }),
  ];

  it("sets exactly the named items, ignoring case", () => {
    const once = applyChecked(list, ["onions"]);
    expect(once.map((i) => i.checked)).toEqual([true, false]);
    expect(applyChecked(once, ["onions"])).toEqual(once);
    expect(applyChecked(once, []).every((i) => !i.checked)).toBe(true);
  });

  it("survive regeneration for ingredients still on the list", () => {
    const previous = applyChecked(list, ["Onions", "Ground beef"]);
    const next = [item({ ingredient: "onions" }), item({ ingredient: "Rice" })];
    expect(carryOverChecked(next, previous).map((i) => i.checked)).toEqual([
      true,
      false,
    ]);
  });
  it("drop a tick when the regenerated item needs a different quantity", () => {
    // Ticked "1 lb" of beef, then a new recipe raised it to 3 lb: the extra
    // 2 lb must stay on the list and in the exported image.
    const previous = [item({ ingredient: "Ground beef", quantity: "1 lb", checked: true })];
    const next = [item({ ingredient: "Ground beef", quantity: "3 lb" })];
    expect(carryOverChecked(next, previous)[0].checked).toBe(false);
    const same = [item({ ingredient: "ground beef", quantity: "1 LB" })];
    expect(carryOverChecked(same, previous)[0].checked).toBe(true);
  });
});

describe("groupByAisle", () => {
  const list = [
    item({ ingredient: "Olive oil", category: "Pantry", staple: true }),
    item({ ingredient: "Onions", quantity: "3 medium" }),
    item({ ingredient: "Pasta", category: "Pantry" }),
  ];

  it("hides staples unless asked", () => {
    expect(groupByAisle(list, { showStaples: false })).toEqual([
      { aisle: "Produce", items: [list[1]] },
      { aisle: "Pantry", items: [list[2]] },
    ]);
    expect(groupByAisle(list, { showStaples: true })[1].items).toEqual([
      list[0],
      list[2],
    ]);
  });

  it("writes one plain line per item for the image", () => {
    expect(groceryLine(list[1])).toBe("Onions - 3 medium");
    expect(groceryLine(list[2])).toBe("Pasta");
  });
});
