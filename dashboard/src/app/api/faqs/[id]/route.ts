import { NextRequest, NextResponse } from "next/server";
import { getDB, getFaqById, updateFaq } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    // Verify ownership
    const faq = await getFaqById(db, id);
    if (!faq || faq.business_id !== businessId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json() as {
      status?: string;
      question?: string;
      answer?: string;
    };

    await updateFaq(db, id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FAQ update error:", error);
    return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
  }
}
