import { NextResponse } from "next/server";
import { getDB, updateAppointmentStatus } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/appointments/[id]
 * Update appointment status (confirm/cancel)
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

    // Verify appointment belongs to this business
    const apt = await db
      .prepare("SELECT business_id FROM appointments WHERE id = ?")
      .bind(id)
      .first<{ business_id: string }>();

    if (!apt || apt.business_id !== businessId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json() as { status: string };
    if (!["confirmed", "cancelled"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await updateAppointmentStatus(db, id, body.status as "confirmed" | "cancelled");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Appointment update error:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}
