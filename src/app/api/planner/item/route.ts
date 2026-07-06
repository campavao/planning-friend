import { NextRequest, NextResponse } from "next/server";
import {
  removePlanItem,
  updatePlanItem,
  getWeekStart,
  userOwnsPlanItem,
  userOwnsContent,
} from "@/lib/supabase";
import { createServerClient } from "@/lib/db/client";
import { parseDateString } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { bustForPlanItem } from "@/lib/db/suggestions";

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

async function getItemPlannedDate(itemId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("planned_date")
    .eq("id", itemId)
    .single();
  if (error || !data) return null;
  return (data as { planned_date: string }).planned_date;
}

function weekStartFromPlannedDate(plannedDate: string): string {
  const dateOnly = plannedDate.split("T")[0];
  return getWeekStart(parseDateString(dateOnly));
}

// DELETE remove item from plan
export async function DELETE(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }

    if (!(await userOwnsPlanItem(itemId, session.userId))) {
      return forbidden();
    }

    const plannedDate = await getItemPlannedDate(itemId);
    if (plannedDate) {
      // Bust caches BEFORE deletion so plan_item_shares lookup still resolves.
      try {
        await bustForPlanItem({
          planItemId: itemId,
          weekStarts: [weekStartFromPlannedDate(plannedDate)],
        });
      } catch (err) {
        console.error("Failed to bust cache before delete:", err);
      }
    }

    await removePlanItem(itemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing plan item:", error);
    return NextResponse.json(
      { error: "Failed to remove item" },
      { status: 500 },
    );
  }
}

// PUT update item in plan
export async function PUT(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireSession(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { id, contentId, noteTitle, notes, plannedDate } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }

    if (!(await userOwnsPlanItem(id, session.userId))) {
      return forbidden();
    }

    // If reassigning to a piece of content, it must be the caller's own.
    if (contentId && !(await userOwnsContent(contentId, session.userId))) {
      return forbidden();
    }
    if (!plannedDate) {
      return NextResponse.json(
        { error: "plannedDate is required" },
        { status: 400 },
      );
    }
    if (!contentId && !noteTitle) {
      return NextResponse.json(
        { error: "Either contentId or noteTitle is required" },
        { status: 400 },
      );
    }

    const updates = contentId
      ? {
          contentId,
          noteTitle: null,
          notes: notes ?? null,
          plannedDate,
        }
      : {
          contentId: null,
          noteTitle,
          notes: notes ?? null,
          plannedDate,
        };

    const oldPlannedDate = await getItemPlannedDate(id);
    const item = await updatePlanItem(id, updates);

    const newWeek = weekStartFromPlannedDate(plannedDate);
    const weekStarts = new Set<string>([newWeek]);
    if (oldPlannedDate) {
      weekStarts.add(weekStartFromPlannedDate(oldPlannedDate));
    }
    bustForPlanItem({
      planItemId: id,
      weekStarts: Array.from(weekStarts),
    }).catch((err) =>
      console.error("Failed to bust cache after update:", err)
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Error updating plan item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 },
    );
  }
}
