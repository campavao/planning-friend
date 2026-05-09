import {
  getGroceryListCache,
  upsertGroceryListCache,
  type CachedGroceryItem,
} from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

interface RecipeInput {
  id: string;
  title: string;
  category: string;
  ingredients: string[];
}

interface GroceryItem {
  ingredient: string;
  quantity?: string;
  category: string;
  sources: { id: string; title: string }[];
  notes?: string;
}

interface GroceryListResponse {
  items: GroceryItem[];
  tips?: string[];
}

const GROCERY_LIST_PROMPT = `You are a helpful meal planning assistant. I'm going to give you a list of recipes with their ingredients. Your job is to create a consolidated, organized grocery list.

**Your Task:**
1. Combine similar ingredients across recipes (e.g., if two recipes need onions, combine them)
2. Organize ingredients into logical grocery store categories
3. Estimate reasonable quantities when combining (e.g., "2 onions" from different recipes might become "3-4 onions")
4. For each ingredient, include which recipe(s) it's needed for
5. Add helpful notes where relevant (e.g., "can substitute with..." or "buy fresh if possible")

**Categories to use:**
- Produce (fruits, vegetables, herbs)
- Meat & Seafood
- Dairy & Eggs
- Pantry (canned goods, dry goods, oils, vinegars)
- Spices & Seasonings
- Frozen
- Bakery & Bread
- Beverages
- Other

**Output Format:**
Return a JSON object with this structure:
{
  "items": [
    {
      "ingredient": "Onions",
      "quantity": "3 medium",
      "category": "Produce",
      "sources": [
        { "id": "recipe-id-1", "title": "Pasta Bolognese" },
        { "id": "recipe-id-2", "title": "French Onion Soup" }
      ],
      "notes": "Yellow onions work best"
    }
  ],
  "tips": [
    "Consider buying a rotisserie chicken to save time on the chicken recipes",
    "Fresh herbs can be substituted with 1/3 the amount of dried herbs"
  ]
}

**Important:**
- Keep ingredient names simple and recognizable (e.g., "Garlic" not "garlic cloves, minced")
- Combine quantities intelligently - don't just add numbers together if it doesn't make sense
- The "sources" array must include the exact id and title from the input recipes
- Only include ingredients that are actually in the recipes provided
- Sort items by category for easier shopping
- Tips are optional but helpful - include 1-3 if relevant

Here are the recipes:
`;

// Check if two arrays of recipe IDs match (order-independent)
function recipeIdsMatch(cached: string[], current: string[]): boolean {
  if (cached.length !== current.length) return false;
  const sortedCached = [...cached].sort();
  const sortedCurrent = [...current].sort();
  return sortedCached.every((id, index) => id === sortedCurrent[index]);
}

// POST - Generate grocery list from recipes (with database caching)
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { recipes, weekStart } = (await request.json()) as {
      recipes: RecipeInput[];
      weekStart: string;
    };

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStart is required" },
        { status: 400 }
      );
    }

    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return NextResponse.json(
        { error: "No recipes provided" },
        { status: 400 }
      );
    }

    // Filter to only recipes with ingredients
    const recipesWithIngredients = recipes.filter(
      (r) => r.ingredients && r.ingredients.length > 0
    );

    if (recipesWithIngredients.length === 0) {
      return NextResponse.json(
        { error: "No recipes with ingredients found" },
        { status: 400 }
      );
    }

    // Get the current recipe IDs (sorted for consistent comparison)
    const currentRecipeIds = recipesWithIngredients.map((r) => r.id).sort();

    const cachedList = await getGroceryListCache(session.userId, weekStart);

    if (cachedList && recipeIdsMatch(cachedList.recipe_ids, currentRecipeIds)) {
      console.log("Grocery list cache hit for week:", weekStart);
      return NextResponse.json({
        success: true,
        items: cachedList.items,
        tips: cachedList.tips,
        recipeCount: currentRecipeIds.length,
        cached: true,
      });
    }

    if (cachedList) {
      console.log(
        "Grocery list cache miss - recipes changed for week:",
        weekStart
      );
    }

    // Cache miss - generate new list with AI
    console.log("Generating new grocery list for week:", weekStart);

    // Build the recipes input for Gemini
    const recipesText = recipesWithIngredients
      .map((recipe, index) => {
        return `Recipe ${index + 1}:
ID: ${recipe.id}
Title: ${recipe.title}
Type: ${recipe.category}
Ingredients:
${recipe.ingredients.map((ing) => `- ${ing}`).join("\n")}
`;
      })
      .join("\n---\n");

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_AI_API_KEY not configured");
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = GROCERY_LIST_PROMPT + recipesText;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = response.text!;

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse Gemini response:", text);
      return NextResponse.json(
        { error: "Failed to generate grocery list" },
        { status: 500 }
      );
    }

    const groceryList = JSON.parse(jsonMatch[0]) as GroceryListResponse;

    // Validate and clean up the response
    if (!groceryList.items || !Array.isArray(groceryList.items)) {
      return NextResponse.json(
        { error: "Invalid grocery list format" },
        { status: 500 }
      );
    }

    // Ensure all items have the required fields
    const cleanedItems = groceryList.items.map((item) => ({
      ingredient: item.ingredient || "Unknown",
      quantity: item.quantity,
      category: item.category || "Other",
      sources: Array.isArray(item.sources) ? item.sources : [],
      notes: item.notes,
    }));

    const tips = groceryList.tips || [];

    try {
      await upsertGroceryListCache(
        session.userId,
        weekStart,
        currentRecipeIds,
        cleanedItems as CachedGroceryItem[],
        tips
      );
      console.log("Grocery list cached for week:", weekStart);
    } catch (err) {
      console.error("Failed to cache grocery list:", err);
    }

    return NextResponse.json({
      success: true,
      items: cleanedItems,
      tips: tips,
      recipeCount: recipesWithIngredients.length,
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
