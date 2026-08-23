import { requireSession } from "@/lib/auth";
import { canDerive, deriveAttributes } from "@/lib/derive-attributes";
import { getContentById, updateContent } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * Fill in the recipe attributes added by PLA-55/57 from what the row already
 * holds. Deliberately NOT a re-process.
 *
 * The reprocess route re-fetches the source and rewrites `data` wholesale,
 * which is how a backfill for four new fields managed to destroy recipes,
 * re-title items, move them between categories, and collapse a 47-line recipe
 * into an echo of its own name. None of that was needed: plants come from the
 * ingredient list, and the ingredient list is already stored.
 *
 * This route only ever adds keys that are currently absent. It never touches
 * title, category, status, thumbnail, ingredients or steps. A failed
 * derivation writes nothing at all, leaving the row exactly as it was.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const content = await getContentById(id);
    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (content.user_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (content.category !== "meal" && content.category !== "drink") {
      return NextResponse.json(
        { error: `Nothing to derive for a ${content.category}` },
        { status: 400 }
      );
    }

    const data = (content.data ?? {}) as Record<string, unknown>;
    const ingredients = Array.isArray(data.ingredients)
      ? (data.ingredients as unknown[]).filter(
          (i): i is string => typeof i === "string"
        )
      : [];
    const recipe = Array.isArray(data.recipe)
      ? (data.recipe as unknown[]).filter((i): i is string => typeof i === "string")
      : [];

    if (!canDerive({ ingredients, recipe })) {
      return NextResponse.json(
        { error: "Nothing stored to derive from — this item has no recipe text" },
        { status: 422 }
      );
    }

    const derived = await deriveAttributes({
      category: content.category,
      title: content.title ?? "",
      ingredients,
      recipe,
    });

    // Only fill gaps. A value already present was either extracted from the
    // real source or set by hand, and is not ours to overwrite for the sake of
    // a backfill.
    const missing = (key: string) => {
      const v = data[key];
      return v === undefined || v === null || v === "" ||
        (Array.isArray(v) && v.length === 0);
    };

    const additions: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(derived)) {
      if (value !== undefined && missing(key)) additions[key] = value;
    }

    if (Object.keys(additions).length === 0) {
      return NextResponse.json({ success: true, added: [], unchanged: true });
    }

    await updateContent(id, { data: { ...data, ...additions } });

    return NextResponse.json({ success: true, added: Object.keys(additions) });
  } catch (error) {
    console.error("Error deriving attributes:", error);
    return NextResponse.json(
      { error: "Failed to derive attributes" },
      { status: 500 }
    );
  }
}
