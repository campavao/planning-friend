import {
  getGroceryListCache,
  updateGroceryListItems,
  upsertGroceryListCache,
} from "@/lib/supabase";
import {
  applyChecked,
  buildGroceryPrompt,
  cacheKeysMatch,
  carryOverChecked,
  groceryCacheKey,
  parseGroceryResponse,
  type QuickNoteInput,
  type RecipeInput,
} from "@/lib/grocery-list";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "@/lib/gemini-model";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

// POST - Generate grocery list from recipes and quick notes (with database caching)
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const body = (await request.json()) as {
      recipes?: RecipeInput[];
      notes?: QuickNoteInput[];
      weekStart: string;
    };
    const { weekStart } = body;

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStart is required" },
        { status: 400 }
      );
    }

    const recipes = (Array.isArray(body.recipes) ? body.recipes : []).filter(
      (r) => Array.isArray(r?.ingredients) && r.ingredients.length > 0
    );
    const notes = (Array.isArray(body.notes) ? body.notes : []).filter(
      (n) => typeof n?.id === "string" && typeof n.title === "string" && n.title.trim()
    );

    if (recipes.length === 0 && notes.length === 0) {
      return NextResponse.json(
        { error: "No meals found for this week" },
        { status: 400 }
      );
    }

    const cacheKey = groceryCacheKey(recipes, notes);
    const cachedList = await getGroceryListCache(session.userId, weekStart);

    if (cachedList && cacheKeysMatch(cachedList.recipe_ids, cacheKey)) {
      console.log("Grocery list cache hit for week:", weekStart);
      return NextResponse.json({
        success: true,
        items: cachedList.items,
        tips: cachedList.tips,
        recipeCount: recipes.length,
        cached: true,
      });
    }

    if (cachedList) {
      console.log("Grocery list cache miss - meals changed for week:", weekStart);
    }

    console.log("Generating new grocery list for week:", weekStart);

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_AI_API_KEY not configured");
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildGroceryPrompt(recipes, notes),
    });
    const text = response.text ?? "";

    const groceryList = parseGroceryResponse(text, recipes, notes);
    if (!groceryList) {
      console.error("Failed to parse Gemini response:", text);
      return NextResponse.json(
        { error: "Failed to generate grocery list" },
        { status: 500 }
      );
    }

    const items = carryOverChecked(groceryList.items, cachedList?.items ?? []);

    try {
      await upsertGroceryListCache(
        session.userId,
        weekStart,
        cacheKey,
        items,
        groceryList.tips
      );
      console.log("Grocery list cached for week:", weekStart);
    } catch (err) {
      console.error("Failed to cache grocery list:", err);
    }

    return NextResponse.json({
      success: true,
      items,
      tips: groceryList.tips,
      recipeCount: recipes.length,
      cached: false,
    });
  } catch (error) {
    console.error("Error generating grocery list:", error);
    return NextResponse.json(
      { error: "Failed to generate grocery list" },
      { status: 500 }
    );
  }
}

// PATCH - Save which items are ticked off. `checked` is the full set of
// ticked ingredient names, so repeating a request is harmless.
export async function PATCH(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { weekStart, checked } = (await request.json()) as {
      weekStart?: string;
      checked?: unknown;
    };

    if (
      !weekStart ||
      !Array.isArray(checked) ||
      !checked.every((c) => typeof c === "string")
    ) {
      return NextResponse.json(
        { error: "weekStart and checked are required" },
        { status: 400 }
      );
    }

    const cachedList = await getGroceryListCache(session.userId, weekStart);
    if (!cachedList) {
      return NextResponse.json(
        { error: "No grocery list for this week" },
        { status: 404 }
      );
    }

    const items = applyChecked(cachedList.items, checked as string[]);
    await updateGroceryListItems(session.userId, weekStart, items);

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Error saving grocery list checks:", error);
    return NextResponse.json(
      { error: "Failed to save grocery list" },
      { status: 500 }
    );
  }
}
