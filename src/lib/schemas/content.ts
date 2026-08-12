import { z } from "zod";
import type { ContentCategory } from "@/lib/db/types";

/**
 * The writable surface of PATCH /api/content/[id].
 *
 * `data` is a JSONB blob whose shape depends on the row's category, and the
 * route used to write whatever the client handed it straight into the column.
 * Everything here exists so a malformed payload cannot corrupt an item — while
 * still letting keys we have never heard of (an older extraction's fields, a
 * field a newer prompt started emitting) survive an edit untouched.
 *
 * Two rules hold the whole design together:
 *
 *  1. What the client sends is a *patch*, not a replacement. Keys absent from
 *     the patch keep their stored value. Saving an ingredient list can't null
 *     out prep_time, because prep_time was never mentioned.
 *  2. A key whose value arrives empty ("" or null) is *removed* from the blob.
 *     Blanking a field in the editor is a real edit, and a key left behind as
 *     an empty string reads as "we extracted a blank" to every later consumer.
 */

export const CONTENT_CATEGORIES = [
  "meal",
  "event",
  "date_idea",
  "gift_idea",
  "travel",
  "drink",
  "other",
] as const satisfies readonly ContentCategory[];

export const contentCategorySchema = z.enum(CONTENT_CATEGORIES);

// Shared with the editor UI so the dropdown options and the values the server
// will accept can never drift apart.
export const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"] as const;
export const DATE_IDEA_TYPES = [
  "dinner",
  "activity",
  "entertainment",
  "outdoors",
  "other",
] as const;
export const TRAVEL_TYPES = [
  "restaurant",
  "attraction",
  "hotel",
  "activity",
  "other",
] as const;
export const DRINK_TYPES = [
  "cocktail",
  "mocktail",
  "coffee",
  "smoothie",
  "wine",
  "beer",
  "other",
] as const;
export const DRINK_DIFFICULTIES = ["easy", "medium", "hard"] as const;

const MAX_TITLE_LENGTH = 300;
const MAX_TEXT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_LINK_LENGTH = 2048;
/** One ingredient or one instruction step — wordy, but still one line. */
const MAX_LINE_LENGTH = 500;
const MAX_LINES = 200;

/**
 * A ceiling on the whole blob. The category schemas pass unknown keys through
 * on purpose, and this is what stops that from being an open invitation to park
 * a megabyte of junk in the row.
 */
export const MAX_CONTENT_DATA_CHARS = 100_000;

/** Stamped by the route whenever a `data` edit lands. Its only job is to let
 *  the detail page tell the owner that re-processing will throw the edit away.
 *  It lives in the blob rather than in a column because this ticket ships no
 *  migration — and it self-clears, since a re-process rewrites `data` whole. */
export const MANUAL_EDIT_STAMP_KEY = "manually_edited_at";

/**
 * Wraps a field so that "" and null both mean "clear this". Text fields would
 * accept "" on their own; enums and booleans would not, and blanking a select
 * has to be expressible or a mis-extracted price range could never be removed.
 */
function clearable<T extends z.ZodTypeAny>(schema: T) {
  return z
    .union([z.literal(""), z.null(), schema])
    .optional()
    .transform<z.infer<T> | null | undefined>((value) => {
      // undefined has to come back out as undefined: zod only writes a key into
      // the parsed object when its value is defined, and that is the entire
      // mechanism by which a field nobody mentioned stays out of the patch.
      if (value === undefined) return undefined;
      if (value === "" || value === null) return null;
      return value as z.infer<T>;
    });
}

const text = clearable(z.string().trim().max(MAX_TEXT_LENGTH));
const description = clearable(z.string().trim().max(MAX_DESCRIPTION_LENGTH));
const flag = clearable(z.boolean());

/**
 * Links are rendered straight into an href, so the scheme is a security
 * question, not a formatting one: a `javascript:` URL pasted here would run on
 * click. A value with no scheme at all is assumed https rather than rejected —
 * "opentable.com/r/x" is what people paste, and a 400 there would read as the
 * editor being broken.
 */
const linkValue = z
  .string()
  .trim()
  .max(MAX_LINK_LENGTH)
  .transform((value, ctx) => {
    if (value === "") return "";

    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
    const candidate = hasScheme ? value : `https://${value}`;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid link",
      });
      return z.NEVER;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Links must start with http:// or https://",
      });
      return z.NEVER;
    }

    if (!parsed.hostname) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid link",
      });
      return z.NEVER;
    }

    // Deliberately the input, not parsed.toString(): the URL parser normalises
    // (it appends a trailing slash to a bare origin), and a save that touched a
    // different field must not quietly rewrite this one.
    return candidate;
  });

const link = clearable(linkValue);

/**
 * Ingredients and instructions. Blank lines are dropped rather than rejected —
 * an empty row is what an editor looks like a keystroke after "Add", and 400ing
 * that would be punishing the user for our own UI.
 */
const lines = z
  .array(z.string().trim().max(MAX_LINE_LENGTH, "That line is too long"), {
    invalid_type_error: "Expected a list of lines",
  })
  .max(MAX_LINES, `Keep it to ${MAX_LINES} lines or fewer`)
  .transform((values) => values.filter((value) => value.length > 0))
  .optional();

const stamp = z.string().max(64).optional();

const mealDataSchema = z
  .object({
    ingredients: lines,
    recipe: lines,
    prep_time: text,
    cook_time: text,
    servings: text,
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const drinkDataSchema = z
  .object({
    ingredients: lines,
    recipe: lines,
    type: clearable(z.enum(DRINK_TYPES)),
    prep_time: text,
    description,
    difficulty: clearable(z.enum(DRINK_DIFFICULTIES)),
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const eventDataSchema = z
  .object({
    location: text,
    date: text,
    time: text,
    requires_reservation: flag,
    requires_ticket: flag,
    ticket_link: link,
    description,
    website: link,
    reservation_link: link,
    image_url: link,
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const dateIdeaDataSchema = z
  .object({
    location: text,
    type: clearable(z.enum(DATE_IDEA_TYPES)),
    price_range: clearable(z.enum(PRICE_RANGES)),
    description,
    website: link,
    menu_link: link,
    reservation_link: link,
    image_url: link,
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const giftIdeaDataSchema = z
  .object({
    name: text,
    cost: text,
    purchase_link: link,
    amazon_link: link,
    description,
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const travelDataSchema = z
  .object({
    location: text,
    type: clearable(z.enum(TRAVEL_TYPES)),
    description,
    website: link,
    booking_link: link,
    price_range: clearable(z.enum(PRICE_RANGES)),
    destination_city: text,
    destination_country: text,
    image_url: link,
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const otherDataSchema = z
  .object({
    description,
    [MANUAL_EDIT_STAMP_KEY]: stamp,
  })
  .passthrough();

const CONTENT_DATA_SCHEMAS = {
  meal: mealDataSchema,
  drink: drinkDataSchema,
  event: eventDataSchema,
  date_idea: dateIdeaDataSchema,
  gift_idea: giftIdeaDataSchema,
  travel: travelDataSchema,
  other: otherDataSchema,
} as const satisfies Record<ContentCategory, z.ZodTypeAny>;

export function contentDataSchemaFor(category: ContentCategory): z.ZodTypeAny {
  return CONTENT_DATA_SCHEMAS[category] ?? otherDataSchema;
}

export const updateContentBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer`)
    .optional(),
  category: contentCategorySchema.optional(),
  // Shape-checked separately, against the category the item is *becoming* —
  // which the object schema has no way to reach from here.
  data: z.record(z.unknown(), { invalid_type_error: "Invalid item details" }).optional(),
  // Starring is a flag and only a flag. It used to be silently dropped when it
  // arrived as anything else; a 400 says so instead of pretending it saved.
  is_favorite: z.boolean().optional(),
});

export type UpdateContentBody = z.infer<typeof updateContentBodySchema>;

export type ContentDataPatchResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeIssue(issue: z.ZodIssue): string {
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

/**
 * Validate a `data` patch against a category and merge it over what is stored.
 *
 * Kept out of the route so the round trip that matters — take a real blob,
 * change one field, assert nothing else moved — is testable without a database.
 */
export function applyContentDataPatch(
  category: ContentCategory,
  stored: unknown,
  patch: Record<string, unknown>
): ContentDataPatchResult {
  const parsed = contentDataSchemaFor(category).safeParse(patch);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]
        ? describeIssue(parsed.error.issues[0])
        : "Invalid item details",
    };
  }

  const merged: Record<string, unknown> = isPlainObject(stored)
    ? { ...stored }
    : {};

  for (const [key, value] of Object.entries(
    parsed.data as Record<string, unknown>
  )) {
    // null is what clearable() turns "" into; undefined only shows up for a key
    // that was explicitly sent as undefined. Both mean "remove it".
    if (value === null || value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  if (JSON.stringify(merged).length > MAX_CONTENT_DATA_CHARS) {
    return { success: false, error: "These details are too large to save" };
  }

  return { success: true, data: merged };
}

/** Whether an item carries the mark PATCH leaves on a hand-edited blob. */
export function hasManualEdits(data: unknown): boolean {
  return isPlainObject(data) && typeof data[MANUAL_EDIT_STAMP_KEY] === "string";
}

/** "", null, undefined and [] all mean the field holds nothing. */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  return Array.isArray(value) && value.length === 0;
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => isSameValue(item, b[i]))
    );
  }
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The keys the editor actually changed, as a patch for the route.
 *
 * The client deliberately does not post the whole blob back. Doing so would
 * re-validate fields the user never touched, so a single bad value left behind
 * by an old extraction ("price_range": "cheap") would block every later save of
 * that item — and it would make "saving persists only the edited fields"
 * something we assert rather than something the wire actually does.
 *
 * `baseline` is the snapshot the editor was seeded from, not the stored row:
 * comparing against what the form was handed is what keeps a value the form
 * merely displayed differently from counting as an edit.
 */
export function diffContentData(
  baseline: Record<string, unknown>,
  edited: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(edited)) {
    if (isSameValue(baseline[key], value)) continue;
    // A field the user blanked goes over the wire as "" — the route reads that
    // as "remove the key", which is not the same as leaving it out.
    patch[key] = isEmptyValue(value) && !Array.isArray(value) ? "" : value;
  }

  return patch;
}
