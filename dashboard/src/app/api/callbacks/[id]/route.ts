import { NextResponse } from "next/server";
import { getDB, updateCallbackStatus } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/callbacks/[id]
 * Mark callback request as completed
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

    // Verify callback belongs to this business
    const cb = await db
      .prepare("SELECT business_id FROM callback_requests WHERE id = ?")
      .bind(id)
      .first<{ business_id: string }>();

    if (!cb || cb.business_id !== businessId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await updateCallbackStatus(db, id, "completed");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Callback update error:", error);
    return NextResponse.json(
      { error: "Failed to update callback" },
      { status: 500 }
    );
  }
}
