import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { triggerEmbeddings } from "@/lib/worker-proxy";

/**
 * POST /api/products/embed
 * Manually trigger product embedding regeneration for semantic search.
 */
export async function POST() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const result = await triggerEmbeddings(businessId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Embedding failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      embedded: result.embedded,
    });
  } catch (error) {
    console.error("Embed trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger embeddings" },
      { status: 500 }
    );
  }
}
