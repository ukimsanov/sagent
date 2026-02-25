import { NextResponse } from "next/server";
import { getDB, getEscalationById, resolveEscalation } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/escalations/[id]
 * Mark an escalation as resolved
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    // Verify escalation exists and belongs to this business
    const escalation = await getEscalationById(db, id);
    if (!escalation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check ownership through lead's business_id
    const lead = await db
      .prepare("SELECT business_id FROM leads WHERE id = ?")
      .bind(escalation.lead_id)
      .first<{ business_id: string }>();

    if (!lead || lead.business_id !== businessId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await resolveEscalation(db, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escalation resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve escalation" },
      { status: 500 }
    );
  }
}
