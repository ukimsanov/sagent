import { NextResponse } from "next/server";
import { getDB, getLeadWithSummary } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { sendWhatsAppMessage } from "@/lib/worker-proxy";

export async function POST(
  request: Request,
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

    // Verify lead exists and belongs to this business
    const leadData = await getLeadWithSummary(db, id);
    if (!leadData || leadData.lead.business_id !== businessId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as { message?: string };
    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }
    if (body.message.length > 4096) {
      return NextResponse.json(
        { error: "Message too long (max 4096 chars)" },
        { status: 400 },
      );
    }

    const result = await sendWhatsAppMessage(
      businessId,
      leadData.lead.whatsapp_number,
      body.message.trim(),
      id,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message" },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Reply error:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 },
    );
  }
}
