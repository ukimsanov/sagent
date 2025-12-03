import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { getDB, getLeads } from "@/lib/db";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

// Default business ID for demo
const BUSINESS_ID = "demo-store-001";

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    new: { variant: "outline", className: "" },
    engaged: { variant: "secondary", className: "bg-chart-5/10 text-chart-5" },
    warm: { variant: "secondary", className: "bg-chart-3/10 text-chart-3" },
    hot: { variant: "secondary", className: "bg-chart-4/10 text-chart-4" },
    converted: { variant: "secondary", className: "bg-chart-2/10 text-chart-2" },
    lost: { variant: "secondary", className: "bg-muted text-muted-foreground" },
  };
  const style = variants[status] || variants.new;
  return <Badge variant={style.variant} className={style.className}>{status}</Badge>;
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-chart-4";
  if (score >= 50) return "text-chart-3";
  if (score >= 20) return "text-chart-5";
  return "text-muted-foreground";
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() / 1000 - timestamp));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  // Use last 2 digits of phone as fallback
  return phone.slice(-2);
}

export default async function LeadsPage() {
  const db = await getDB();
  const { leads, total } = await getLeads(db, BUSINESS_ID, { limit: 50 });

  // Calculate stats from actual leads
  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.status === 'hot').length,
    warm: leads.filter(l => l.status === 'warm').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track your customer leads ({total} total)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-chart-4">{stats.hot}</div>
            <p className="text-xs text-muted-foreground">Hot Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-chart-3">{stats.warm}</div>
            <p className="text-xs text-muted-foreground">Warm Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-chart-2">{stats.converted}</div>
            <p className="text-xs text-muted-foreground">Converted</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name or phone..."
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

      {/* Leads table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Last Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length > 0 ? (
                leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={`/conversations/${lead.id}`} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(lead.name, lead.whatsapp_number)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {lead.name || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            +{lead.whatsapp_number}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/conversations/${lead.id}`} className="block">
                        <div className={`font-bold ${getScoreColor(lead.score)}`}>
                          {lead.score}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/conversations/${lead.id}`} className="block">
                        {getStatusBadge(lead.status)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link href={`/conversations/${lead.id}`} className="block">
                        {lead.message_count}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Link href={`/conversations/${lead.id}`} className="block">
                        {formatTimeAgo(lead.last_contact)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No leads yet
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
