import { NextRequest, NextResponse } from "next/server";
import { getContentByUser } from "@/lib/supabase";
import { requireAlexaToken } from "@/lib/alexa-auth";

// Returns your recipe titles formatted as Alexa DishName slot values.
// Paste the `values` array into the DishName slot type in the Alexa Console
// whenever you add recipes, so GetRecipeIntent can resolve them reliably.
export async function GET(request: NextRequest) {
  const { context, errorResponse } = requireAlexaToken(request);
  if (errorResponse) return errorResponse;

  try {
    const all = await getContentByUser(context.userId);
    const values = all
      .filter(
        (c) =>
          c.status === "completed" &&
          (c.category === "meal" || c.category === "drink")
      )
      .map((c) => ({ name: { value: c.title } }));
    return NextResponse.json({ count: values.length, values });
  } catch (error) {
    console.error("Error fetching Alexa dish slot:", error);
    return NextResponse.json(
      { error: "Failed to fetch dish slot values" },
      { status: 500 }
    );
  }
}
