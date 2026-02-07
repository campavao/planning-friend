import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createShareInvite,
  claimShareInvite,
  getSharedPlans,
  removePlanShare,
  getWeeklyPlan,
} from "@/lib/supabase";

interface SessionData {
  userId: string;
  phoneNumber: string;
  exp: number;
}

async function getSessionUser(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString(),
    ) as SessionData;

    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// GET - Get shared plans for user
export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sharedPlans = await getSharedPlans(session.userId);

    return NextResponse.json({ sharedPlans });
  } catch (error) {
    console.error("Error fetching shared plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Create share invite or claim share code
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, planId, weekStart, shareCode } = await request.json();

    if (action === "create") {
      // Create a share invite for a plan
      if (!planId && !weekStart) {
        return NextResponse.json(
          { error: "planId or weekStart required" },
          { status: 400 },
        );
      }

      let targetPlanId = planId;

      // If weekStart provided, get or create the plan for that week
      if (weekStart && !planId) {
        const plan = await getWeeklyPlan(session.userId, weekStart);
        if (!plan) {
          return NextResponse.json(
            { error: "No plan found for that week" },
            { status: 404 },
          );
        }
        targetPlanId = plan.id;
      }

      const invite = await createShareInvite(targetPlanId, session.userId);

      return NextResponse.json({
        shareCode: invite.share_code,
        expiresAt: invite.expires_at,
      });
    } else if (action === "claim") {
      // Claim a share code to get access to a plan
      if (!shareCode) {
        return NextResponse.json(
          { error: "shareCode required" },
          { status: 400 },
        );
      }

      const planShare = await claimShareInvite(shareCode, session.userId);

      return NextResponse.json({
        success: true,
        planShare,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error with share action:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove a share (leave shared plan)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planId = request.nextUrl.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    await removePlanShare(planId, session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing share:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
