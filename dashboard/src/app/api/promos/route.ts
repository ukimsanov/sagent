import { NextResponse } from "next/server";
import { getDB, createPromoCode } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

/**
 * POST /api/promos
 * Create a new promo code
 */
export async function POST(request: Request) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const body = await request.json() as {
      code: string;
      discount_percent?: number | null;
      discount_amount?: number | null;
      expires_at?: number | null;
    };

    if (!body.code || body.code.trim() === "") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    await createPromoCode(db, {
      business_id: businessId,
      code: body.code.trim().toUpperCase(),
      discount_percent: body.discount_percent,
      discount_amount: body.discount_amount,
      expires_at: body.expires_at,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promo create error:", error);
    return NextResponse.json(
      { error: "Failed to create promo code" },
      { status: 500 }
    );
  }
}
