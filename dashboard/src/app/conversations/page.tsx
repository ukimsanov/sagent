import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { getDB, getMessageEvents } from "@/lib/db";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

// Default business ID for demo
const BUSINESS_ID = "demo-store-001";

function getActionBadge(action: string) {
  const colors: Record<string, string> = {
    show_products: "bg-primary/10 text-primary",
    ask_clarification: "bg-chart-3/10 text-chart-3",
    answer_question: "bg-chart-2/10 text-chart-2",
    empathize: "bg-chart-4/10 text-chart-4",
    greet: "bg-chart-5/10 text-chart-5",
    thank: "bg-chart-2/10 text-chart-2",
    handoff: "bg-destructive/10 text-destructive",
  };
  return colors[action] || "bg-muted text-muted-foreground";
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function maskPhone(leadId: string) {
  // Extract last 4 chars for display
  const last4 = leadId.slice(-4);
  return `+1 xxx-xxx-${last4}`;
}

export default async function ConversationsPage() {
  const db = await getDB();
  const { events, total } = await getMessageEvents(db, BUSINESS_ID, { limit: 50 });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">
            View and manage all customer conversations ({total} total)
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by phone or message..."
                className="pl-9 h-9"
              />
            </div>
            <button className="inline-flex items-center justify-center gap-2 px-4 h-9 border rounded-md hover:bg-muted transition-colors text-sm">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Conversations table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Last Message</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length > 0 ? (
                events.map((event) => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-mono text-sm">
                      <Link href={`/conversations/${event.lead_id}`} className="block">
                        {maskPhone(event.lead_id)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      <Link href={`/conversations/${event.lead_id}`} className="block">
                        {event.user_message || "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/conversations/${event.lead_id}`} className="block">
                        <Badge variant="secondary" className={getActionBadge(event.action)}>
                          {event.action.replace(/_/g, " ")}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Link href={`/conversations/${event.lead_id}`} className="block">
                        {event.intent_type?.replace(/_/g, " ") || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Link href={`/conversations/${event.lead_id}`} className="block">
                        {formatTimeAgo(event.timestamp)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/conversations/${event.lead_id}`} className="block">
                        {event.flagged_for_human ? (
                          <Badge variant="destructive">Flagged</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No conversations yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
