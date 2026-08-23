import { GoogleGenAI } from "@google/genai";
import type { ContentCategory } from "@/lib/db/types";
import { GEMINI_MODEL } from "@/lib/gemini-model";
import { PLANT_RULES } from "@/lib/gemini";
import { readPlants } from "@/lib/plants";
import { RECIPE_EFFORTS, SPICE_LEVELS } from "@/lib/schemas/content";

/**
 * Derive the recipe attributes added by PLA-55/57 from what a row already
 * holds, without re-fetching or rewriting anything.
 *
 * The original backfill re-ran the whole extraction pipeline against the source
 * URL and wrote the resulting `data` blob back wholesale. That exposed every
 * item to failures with nothing to do with plants: sites blocking the scraper,
 * the model re-titling or re-categorising an item, and in one case a recipe of
 * 21 ingredients and 26 steps collapsing into three lines echoing its own
 * title. None of that was necessary. The plants come from the ingredient list,
 * and the ingredient list is already in the database.
 *
 * So: read the stored ingredients and steps, ask only for the four new fields,
 * and let the caller merge them in. Nothing else can change, and a failure
 * leaves the fields unset — exactly where they started.
 */

const MODEL = GEMINI_MODEL;

export interface DerivedAttributes {
  plants?: ReturnType<typeof readPlants>;
  effort?: string;
  spice?: string;
  equipment?: string[];
}

export interface DeriveInput {
  category: ContentCategory;
  title: string;
  ingredients: string[];
  recipe: string[];
}

/** Enough to reason about? Nothing useful comes from an empty ingredient list. */
export function canDerive(input: Pick<DeriveInput, "ingredients" | "recipe">): boolean {
  return input.ingredients.length > 0 || input.recipe.length > 0;
}

function buildPrompt(input: DeriveInput): string {
  const isMeal = input.category === "meal";
  const wanted = isMeal
    ? `"plants", "effort", "spice", "equipment"`
    : `"equipment"`;

  return `You are given a recipe that has already been transcribed. Do not invent
anything that is not present in it, and do not restate the recipe back.

Return ONLY a JSON object with these keys: ${wanted}

- effort: exactly one of ${RECIPE_EFFORTS.map((e) => `"${e}"`).join(", ")}
- spice: exactly one of ${SPICE_LEVELS.map((e) => `"${e}"`).join(", ")}
- equipment: array of strings — the tools and cookware the steps require
${isMeal ? `\n${PLANT_RULES}\n` : ""}
If a value cannot be determined from the text below, omit that key entirely.
Never guess.

TITLE: ${input.title}

INGREDIENTS:
${input.ingredients.map((i) => `- ${i}`).join("\n") || "(none recorded)"}

STEPS:
${input.recipe.map((r, n) => `${n + 1}. ${r}`).join("\n") || "(none recorded)"}`;
}

function parseJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Keep only what is well-formed. A field the model got wrong is dropped rather
 * than corrected — an absent spice level renders as nothing, an invented one
 * renders as a confident lie.
 */
export function readDerived(
  category: ContentCategory,
  raw: Record<string, unknown> | null
): DerivedAttributes {
  if (!raw) return {};
  const out: DerivedAttributes = {};

  if (category === "meal") {
    const plants = readPlants(raw.plants);
    if (plants.length) out.plants = plants;

    if (
      typeof raw.effort === "string" &&
      (RECIPE_EFFORTS as readonly string[]).includes(raw.effort)
    ) {
      out.effort = raw.effort;
    }
    if (
      typeof raw.spice === "string" &&
      (SPICE_LEVELS as readonly string[]).includes(raw.spice)
    ) {
      out.spice = raw.spice;
    }
  }

  if (Array.isArray(raw.equipment)) {
    const equipment = raw.equipment
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim())
      .filter(Boolean);
    if (equipment.length) out.equipment = equipment;
  }

  return out;
}

/**
 * Ask the model for the new fields only. Returns {} on any failure — there is
 * no fallback object here on purpose. The whole point is that a bad call
 * leaves the row untouched.
 */
export async function deriveAttributes(
  input: DeriveInput
): Promise<DerivedAttributes> {
  if (!canDerive(input)) return {};

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY environment variable");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(input),
    });
    return readDerived(input.category, parseJson(response.text ?? ""));
  } catch (error) {
    console.error("deriveAttributes failed:", error);
    return {};
  }
}
