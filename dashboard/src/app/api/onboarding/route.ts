import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getUserBusinessId, addUserToBusiness } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

interface OnboardingBody {
  name: string;
  timezone?: string;
  brand_tone?: string;
  greeting_template?: string;
}

/**
 * POST /api/onboarding
 * Create a new business and link it to the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();

    // Check if user already has a business
    const existingBusiness = await getUserBusinessId(db, user.id);
    if (existingBusiness) {
      return NextResponse.json(
        { error: "Business already exists", businessId: existingBusiness },
        { status: 409 }
      );
    }

    const body = await request.json() as OnboardingBody;

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const businessId = `biz-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    // Create the business
    await db
      .prepare(`
        INSERT INTO businesses (
          id, name, whatsapp_phone_id,
          brand_tone, greeting_template, timezone,
          ai_enabled, auto_handoff_threshold,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        businessId,
        body.name.trim(),
        "", // whatsapp_phone_id — configured separately
        body.brand_tone || "friendly",
        body.greeting_template || null,
        body.timezone || "UTC",
        1, // ai_enabled
        3, // auto_handoff_threshold
        now,
        now
      )
      .run();

    // Link user to business as admin
    await addUserToBusiness(db, user.id, businessId, "admin");

    return NextResponse.json({ businessId }, { status: 201 });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
