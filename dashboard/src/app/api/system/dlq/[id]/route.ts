import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getDB, resolveDlqEntry } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    await requireBusinessId(db, user.id);

    const { id } = await params;
    await resolveDlqEntry(db, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DLQ resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve" },
      { status: 500 },
    );
  }
}
