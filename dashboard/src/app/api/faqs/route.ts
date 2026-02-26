import { NextRequest, NextResponse } from "next/server";
import { getDB, getFaqs } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const status = request.nextUrl.searchParams.get("status") || undefined;
    const faqs = await getFaqs(db, businessId, status);

    return NextResponse.json({ faqs });
  } catch (error) {
    console.error("FAQ list error:", error);
    return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}
