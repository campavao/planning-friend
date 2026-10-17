/**
 * The weekly grocery list: what goes into the generator, what comes out, and
 * the shape stored in `grocery_list_cache`.
 *
 * Pure functions only, so the route, the planner page and the tests share one
 * definition of an item and of the cache key.
 */

/** Store sections in walking order. The list, the image and the cache all sort by this. */
export const GROCERY_AISLES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery & Bread",
  "Pantry",
  "Spices & Seasonings",
  "Frozen",
  "Beverages",
  "Other",
] as const;

export type GroceryAisle = (typeof GROCERY_AISLES)[number];

/** A planned item with real ingredients (a saved meal or drink). */
export interface RecipeInput {
  id: string;
  title: string;
  category: string;
  ingredients: string[];
}

/** A quick note from the planner ("Steak & veggies", "Iowa"). The id is the plan item id. */
export interface QuickNoteInput {
  id: string;
  title: string;
}

export interface GrocerySource {
  id: string;
  title: string;
  /** "recipe" ids are content ids. "note" ids are plan item ids and have no page to link to. */
  kind: "recipe" | "note";
}

/**
 * One line of the list, exactly as stored in `grocery_list_cache.items`.
 *
 * Readers outside the app (scripts, agents) can rely on every field except
 * `quantity` and `notes`. A row cached before the flags existed lacks
 * `estimated`, `staple` and `checked` until it is regenerated or ticked;
 * treat a missing flag as false.
 */
export interface GroceryItem {
  ingredient: string;
  quantity?: string;
  category: GroceryAisle;
  sources: GrocerySource[];
  notes?: string;
  /** Every source is a quick note, so the ingredient was guessed from a meal name. */
  estimated: boolean;
  /** Oil, salt, common spices: most kitchens already have it. Hidden by default. */
  staple: boolean;
  /** Ticked off while shopping. */
  checked: boolean;
}

const KNOWN_STAPLES = new Set([
  "salt",
  "kosher salt",
  "sea salt",
  "pepper",
  "black pepper",
  "salt and pepper",
  "salt & pepper",
  "oil",
  "olive oil",
  "extra virgin olive oil",
  "vegetable oil",
  "canola oil",
  "cooking spray",
  "sugar",
  "flour",
  "all-purpose flour",
  "baking soda",
  "baking powder",
  "garlic powder",
  "onion powder",
  "paprika",
  "cumin",
  "chili powder",
  "red pepper flakes",
  "dried oregano",
  "oregano",
  "italian seasoning",
  "soy sauce",
  "vinegar",
  "water",
]);

/** The identity of an item across regenerations and check-off requests. */
export function groceryItemKey(ingredient: string): string {
  return ingredient.trim().toLowerCase().replace(/\s+/g, " ");
}

function noteCacheKey(title: string): string {
  return `note:${groceryItemKey(title)}`;
}

/**
 * The value stored in `grocery_list_cache.recipe_ids`.
 *
 * Recipe content ids plus one `note:<title>` entry per quick note, sorted.
 * Duplicates stay, because the same meal twice in a week needs more food.
 * Editing, adding or removing a quick note changes the key and so
 * regenerates the list.
 */
export function groceryCacheKey(
  recipes: RecipeInput[],
  notes: QuickNoteInput[],
): string[] {
  return [
    ...recipes.map((r) => r.id),
    ...notes.map((n) => noteCacheKey(n.title)),
  ].sort();
}

export function cacheKeysMatch(cached: string[], current: string[]): boolean {
  if (cached.length !== current.length) return false;
  const sorted = [...cached].sort();
  return sorted.every((key, index) => key === current[index]);
}

const GROCERY_LIST_PROMPT = `You are a helpful meal planning assistant. I'm going to give you this week's planned recipes with their ingredients, and possibly some quick notes the user jotted in their planner. Your job is to create a consolidated, organized grocery list.

**Your Task:**
1. Combine similar ingredients across recipes and meals (e.g., if two recipes need onions, combine them)
2. Organize ingredients into logical grocery store categories
3. Estimate reasonable quantities when combining (e.g., "2 onions" from different recipes might become "3-4 onions")
4. For each ingredient, include which recipe(s) or note(s) it's needed for
5. Add helpful notes where relevant (e.g., "can substitute with..." or "buy fresh if possible")
6. Mark pantry staples with "staple": true. A staple is something most home kitchens already keep stocked: cooking oils, salt, pepper, sugar, flour, common dried spices and seasonings, vinegar, soy sauce. Fresh produce, meat, dairy and anything bought for a specific dish are never staples.

**Quick notes:**
Quick notes are short free-text entries with no recipe, such as "Mac and cheese and broc", "Steak & veggies" or "Bok choy".
- If a note names a meal or a food, infer the basic ingredients a home cook would buy to make it (keep it short: the main components, not a full recipe).
- If a note is not food, ignore it completely. Examples: travel ("Iowa"), events or birthdays ("Rosh bday"), eating out or takeout ("Order", "Dinner at Mom's", "Pizza night out").

**Categories to use (exactly these names):**
${GROCERY_AISLES.map((aisle) => `- ${aisle}`).join("\n")}

**Output Format:**
Return a JSON object with this structure:
{
  "items": [
    {
      "ingredient": "Onions",
      "quantity": "3 medium",
      "category": "Produce",
      "staple": false,
      "sources": [
        { "id": "recipe-id-1", "title": "Pasta Bolognese" },
        { "id": "note-id-1", "title": "Steak & veggies" }
      ],
      "notes": "Yellow onions work best"
    }
  ],
  "tips": [
    "Consider buying a rotisserie chicken to save time on the chicken recipes"
  ]
}

**Important:**
- Keep ingredient names simple and recognizable (e.g., "Garlic" not "garlic cloves, minced")
- Combine quantities intelligently - don't just add numbers together if it doesn't make sense
- The "sources" array must include the exact id and title from the input recipes or notes
- Only include ingredients that are in the recipes provided or that the food notes clearly need
- Sort items by category for easier shopping
- Tips are optional but helpful - include 1-3 if relevant
`;

export function buildGroceryPrompt(
  recipes: RecipeInput[],
  notes: QuickNoteInput[],
): string {
  const sections: string[] = [GROCERY_LIST_PROMPT];

  if (recipes.length > 0) {
    const recipesText = recipes
      .map(
        (recipe, index) => `Recipe ${index + 1}:
ID: ${recipe.id}
Title: ${recipe.title}
Type: ${recipe.category}
Ingredients:
${recipe.ingredients.map((ing) => `- ${ing}`).join("\n")}
`,
      )
      .join("\n---\n");
    sections.push(`Here are the recipes:\n${recipesText}`);
  }

  if (notes.length > 0) {
    const notesText = notes
      .map((note) => `- ID: ${note.id} | Note: ${note.title}`)
      .join("\n");
    sections.push(`Here are the quick notes:\n${notesText}\n`);
  }

  return sections.join("\n");
}

function toAisle(category: unknown): GroceryAisle {
  if (typeof category !== "string") return "Other";
  const match = GROCERY_AISLES.find(
    (aisle) => aisle.toLowerCase() === category.trim().toLowerCase(),
  );
  return match ?? "Other";
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sortByAisle(items: GroceryItem[]): GroceryItem[] {
  return [...items].sort(
    (a, b) =>
      GROCERY_AISLES.indexOf(a.category) - GROCERY_AISLES.indexOf(b.category),
  );
}

/**
 * Turn one raw item (from the model, or a cached row written before these
 * flags existed) into a complete GroceryItem.
 *
 * `inputs` maps every known source id to its kind and title. When it is
 * given, the item is fresh from the model: sources it invented are dropped
 * and `estimated` is derived from the surviving sources rather than trusted.
 */
function normalizeItem(
  raw: Record<string, unknown>,
  inputs?: Map<string, Omit<GrocerySource, "id">>,
): GroceryItem | null {
  const ingredient = optionalText(raw.ingredient);
  if (!ingredient) return null;

  const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
  const sources: GrocerySource[] = [];
  for (const source of rawSources as Record<string, unknown>[]) {
    const id = typeof source?.id === "string" ? source.id : null;
    if (!id) continue;
    if (inputs) {
      const known = inputs.get(id);
      if (known) sources.push({ id, ...known });
    } else {
      sources.push({
        id,
        title: optionalText(source.title) ?? "",
        kind: source.kind === "note" ? "note" : "recipe",
      });
    }
  }

  return {
    ingredient,
    quantity: optionalText(raw.quantity),
    category: toAisle(raw.category),
    sources,
    notes: optionalText(raw.notes),
    estimated: inputs
      ? sources.length > 0 && sources.every((s) => s.kind === "note")
      : raw.estimated === true,
    // The known list only fills in a missing flag (old cached rows, a reply
    // that left it out). An explicit `false` means the model saw it was
    // bought for a dish, e.g. "Flour - 6 cups" for bread, and it must not
    // vanish from the list and the exported image.
    staple:
      typeof raw.staple === "boolean"
        ? raw.staple
        : KNOWN_STAPLES.has(groceryItemKey(ingredient)),
    // Only a person ticks items off; a model reply always starts unchecked.
    checked: !inputs && raw.checked === true,
  };
}

export interface ParsedGroceryList {
  items: GroceryItem[];
  tips: string[];
}

/** Parse the model's reply. Returns null when it holds no usable item list. */
export function parseGroceryResponse(
  text: string,
  recipes: RecipeInput[],
  notes: QuickNoteInput[],
): ParsedGroceryList | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: { items?: unknown; tips?: unknown };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.items)) return null;

  const inputs = new Map<string, Omit<GrocerySource, "id">>();
  for (const r of recipes) inputs.set(r.id, { title: r.title, kind: "recipe" });
  for (const n of notes) inputs.set(n.id, { title: n.title, kind: "note" });

  const items = (parsed.items as Record<string, unknown>[])
    .map((raw) => normalizeItem(raw ?? {}, inputs))
    .filter((item): item is GroceryItem => item !== null);

  const tips = Array.isArray(parsed.tips)
    ? parsed.tips.filter((tip): tip is string => typeof tip === "string")
    : [];

  return { items: sortByAisle(items), tips };
}

/** Read a cached row's items, filling in flags that older rows lack. */
export function normalizeCachedItems(items: unknown): GroceryItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => normalizeItem((raw ?? {}) as Record<string, unknown>))
    .filter((item): item is GroceryItem => item !== null);
}

/** Set `checked` on exactly the items whose key is in `checkedKeys`. */
export function applyChecked(
  items: GroceryItem[],
  checkedKeys: Iterable<string>,
): GroceryItem[] {
  const keys = new Set([...checkedKeys].map(groceryItemKey));
  return items.map((item) => ({
    ...item,
    checked: keys.has(groceryItemKey(item.ingredient)),
  }));
}

/**
 * Keep what was already ticked off when a list is regenerated.
 *
 * A tick carries over only when the item still needs the same quantity. If
 * the new plan needs more (1 lb of beef became 3 lb), the item comes back
 * unticked so the rest stays on the list and in the exported image.
 */
export function carryOverChecked(
  next: GroceryItem[],
  previous: GroceryItem[],
): GroceryItem[] {
  const quantityKey = (item: GroceryItem) =>
    groceryItemKey(item.quantity ?? "");
  const ticked = new Map<string, Set<string>>();
  for (const item of previous) {
    if (!item.checked) continue;
    const key = groceryItemKey(item.ingredient);
    if (!ticked.has(key)) ticked.set(key, new Set());
    ticked.get(key)!.add(quantityKey(item));
  }
  return next.map((item) => ({
    ...item,
    checked:
      ticked.get(groceryItemKey(item.ingredient))?.has(quantityKey(item)) ??
      false,
  }));
}

export interface AisleGroup {
  aisle: GroceryAisle;
  items: GroceryItem[];
}

/** Items grouped by aisle in walking order, with staples left out unless asked for. */
export function groupByAisle(
  items: GroceryItem[],
  { showStaples }: { showStaples: boolean },
): AisleGroup[] {
  const visible = items.filter((item) => showStaples || !item.staple);
  return GROCERY_AISLES.map((aisle) => ({
    aisle,
    items: visible.filter((item) => item.category === aisle),
  })).filter((group) => group.items.length > 0);
}

/** One plain line per item for the exported image, e.g. "Onions - 3 medium". */
export function groceryLine(item: GroceryItem): string {
  return item.quantity
    ? `${item.ingredient} - ${item.quantity}`
    : item.ingredient;
}
