import { NextRequest, NextResponse } from "next/server";
import {
  getAllSharedContent,
  getContentByUser,
  type Content,
  type DrinkData,
  type MealData,
} from "@/lib/supabase";
import { requireAlexaToken } from "@/lib/alexa-auth";

interface RecipeResponse {
  found: boolean;
  id?: string;
  title?: string;
  category?: string;
  ingredients?: string[];
  steps?: string[];
  sharedBy?: string;
  speech: string;
}

interface RecipeCandidate {
  content: Content;
  sharedBy?: string;
}

// Fetches a recipe (meal or drink) by fuzzy-matched name and shapes it
// for Alexa. Returns an SSML-ready speech string with step-by-step pacing.
export async function GET(request: NextRequest) {
  const { context, errorResponse } = requireAlexaToken(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "name query param required" },
      { status: 400 }
    );
  }

  try {
    const pool = await buildSearchPool(context.userId);
    const match = findBestMatch(name, pool);
    if (!match) {
      const body: RecipeResponse = {
        found: false,
        speech: `I couldn't find a recipe called ${name}.`,
      };
      return NextResponse.json(body, { status: 404 });
    }

    const data = (match.content.data ?? {}) as MealData | DrinkData;
    const ingredients = (data.ingredients ?? []).slice();
    const steps = (data.recipe ?? []).slice();

    const body: RecipeResponse = {
      found: true,
      id: match.content.id,
      title: match.content.title,
      category: match.content.category,
      ingredients,
      steps,
      sharedBy: match.sharedBy,
      speech: buildRecipeSpeech(
        match.content.title,
        ingredients,
        steps,
        match.sharedBy
      ),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Error fetching Alexa recipe:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500 }
    );
  }
}

async function buildSearchPool(userId: string): Promise<RecipeCandidate[]> {
  const own = await getContentByUser(userId);
  const ownRecipes: RecipeCandidate[] = own
    .filter(
      (c) =>
        c.status === "completed" &&
        (c.category === "meal" || c.category === "drink")
    )
    .map((content) => ({ content }));

  let sharedRecipes: RecipeCandidate[] = [];
  try {
    const shared = await getAllSharedContent(userId);
    sharedRecipes = shared
      .filter(
        ({ content }) =>
          content.status === "completed" &&
          (content.category === "meal" || content.category === "drink")
      )
      .map(({ content, ownerName }) => ({ content, sharedBy: ownerName }));
  } catch (err) {
    console.error("Failed to fetch shared recipes:", err);
  }

  // Own content takes precedence if the same id appears in both lists.
  const seen = new Set(ownRecipes.map((r) => r.content.id));
  const deduped = sharedRecipes.filter((r) => !seen.has(r.content.id));
  return [...ownRecipes, ...deduped];
}

function findBestMatch(
  query: string,
  candidates: RecipeCandidate[]
): (RecipeCandidate & { score: number }) | null {
  const q = normalize(query);
  if (!q) return null;
  let best: (RecipeCandidate & { score: number }) | null = null;
  for (const candidate of candidates) {
    const score = scoreTitle(q, normalize(candidate.content.title));
    if (score > 0 && (!best || score > best.score)) {
      best = { ...candidate, score };
    }
  }
  return best;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Scoring prefers exact matches, then substring, then word overlap. Tuned
// empirically for short recipe titles (1-5 words).
function scoreTitle(query: string, title: string): number {
  if (!query || !title) return 0;
  if (query === title) return 1000;
  if (title.includes(query)) return 500 + query.length;
  if (query.includes(title)) return 400 + title.length;
  const qWords = new Set(query.split(" ").filter(Boolean));
  const tWords = title.split(" ").filter(Boolean);
  const overlap = tWords.filter((w) => qWords.has(w)).length;
  return overlap * 10;
}

function buildRecipeSpeech(
  title: string,
  ingredients: string[],
  steps: string[],
  sharedBy?: string
): string {
  const intro = sharedBy
    ? `Here's ${sharedBy}'s recipe for ${title}.`
    : `Here's the recipe for ${title}.`;
  const parts: string[] = [intro];

  if (ingredients.length > 0) {
    parts.push(`You'll need: ${joinList(ingredients)}.`);
    parts.push('<break time="700ms"/>');
  }

  if (steps.length > 0) {
    parts.push("Here are the steps.");
    steps.forEach((step, i) => {
      parts.push(`<break time="500ms"/> Step ${i + 1}. ${step}`);
    });
  } else if (ingredients.length === 0) {
    parts.push("No detailed steps are saved for this recipe.");
  }

  return parts.join(" ");
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
