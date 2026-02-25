import { NextResponse } from "next/server";
import { getDB, deactivatePromoCode } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/promos/[id]
 * Deactivate a promo code
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

    // Verify promo belongs to this business
    const promo = await db
      .prepare("SELECT business_id FROM promo_codes WHERE id = ?")
      .bind(id)
      .first<{ business_id: string }>();

    if (!promo || promo.business_id !== businessId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deactivatePromoCode(db, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promo deactivate error:", error);
    return NextResponse.json(
      { error: "Failed to deactivate promo" },
      { status: 500 }
    );
  }
}
