import { NextRequest, NextResponse } from "next/server";
import { getDB, getMessageEvents, getLeads, getEscalations } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

function escapeCsv(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/export?type=conversations|leads|escalations
 * Export data as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type || !["conversations", "leads", "escalations"].includes(type)) {
      return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    let csvContent = "";
    let filename = "";
    const dateStr = new Date().toISOString().split("T")[0];

    if (type === "conversations") {
      const { events } = await getMessageEvents(db, businessId, { limit: 10000 });
      csvContent = "Timestamp,Lead ID,Action,Intent,User Message,Agent Response,Search Query,Flagged,Sentiment\n";
      for (const e of events) {
        csvContent += [
          new Date(e.timestamp).toISOString(),
          e.lead_id,
          e.action,
          e.intent_type || "",
          escapeCsv(e.user_message),
          escapeCsv(e.agent_response),
          e.search_query || "",
          e.flagged_for_human,
          e.sentiment || "",
        ].join(",") + "\n";
      }
      filename = `conversations-${dateStr}.csv`;
    }

    if (type === "leads") {
      const { leads } = await getLeads(db, businessId, { limit: 10000 });
      csvContent = "ID,Name,Phone,Email,Score,Status,Message Count,First Contact,Last Contact,Tags\n";
      for (const l of leads) {
        csvContent += [
          l.id,
          escapeCsv(l.name),
          l.whatsapp_number,
          l.email || "",
          l.score,
          l.status,
          l.message_count,
          new Date(l.first_contact * 1000).toISOString(),
          new Date(l.last_contact * 1000).toISOString(),
          escapeCsv(l.tags),
        ].join(",") + "\n";
      }
      filename = `leads-${dateStr}.csv`;
    }

    if (type === "escalations") {
      const escalations = await getEscalations(db, businessId, { status: "all" });
      csvContent = "ID,Lead Name,Phone,Urgency,Reason,Resolved,Created At,Resolved At\n";
      for (const e of escalations) {
        csvContent += [
          e.id,
          escapeCsv(e.lead_name),
          e.whatsapp_number,
          e.urgency,
          escapeCsv(e.reason),
          e.resolved ? "Yes" : "No",
          new Date(e.created_at * 1000).toISOString(),
          e.resolved_at ? new Date(e.resolved_at * 1000).toISOString() : "",
        ].join(",") + "\n";
      }
      filename = `escalations-${dateStr}.csv`;
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
