import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { getDB, getEscalations, getEscalationStats } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ResolveButton } from "@/components/escalations/resolve-button";

export const dynamic = "force-dynamic";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const urgencyConfig = {
  high: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "High" },
  medium: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Medium" },
  low: { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Low" },
};

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; urgency?: string }>;
}) {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const statusFilter = (sp.status || "open") as "open" | "resolved" | "all";
  const urgencyFilter = sp.urgency as "low" | "medium" | "high" | undefined;

  const [escalations, stats] = await Promise.all([
    getEscalations(db, businessId, { status: statusFilter, urgency: urgencyFilter }),
    getEscalationStats(db, businessId),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Escalation Queue</h1>
        <p className="text-muted-foreground">
          Conversations flagged for human attention
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Open Escalations"
          value={stats.openCount}
          description="Awaiting resolution"
          iconName="alert-circle"
          delay={0}
        />
        <StatsCard
          title="High Urgency"
          value={stats.highUrgency}
          description="Needs immediate action"
          iconName="alert-circle"
          delay={0.05}
        />
        <StatsCard
          title="Resolved Today"
          value={stats.resolvedToday}
          description="Handled today"
          iconName="shield-check"
          delay={0.1}
        />
        <StatsCard
          title="Total Flags"
          value={stats.total}
          description="All-time escalations"
          iconName="bar-chart"
          delay={0.15}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Link href="/escalations?status=open">
          <Badge
            variant={statusFilter === "open" ? "default" : "outline"}
            className="cursor-pointer"
          >
            Open
          </Badge>
        </Link>
        <Link href="/escalations?status=resolved">
          <Badge
            variant={statusFilter === "resolved" ? "default" : "outline"}
            className="cursor-pointer"
          >
            Resolved
          </Badge>
        </Link>
        <Link href="/escalations?status=all">
          <Badge
            variant={statusFilter === "all" ? "default" : "outline"}
            className="cursor-pointer"
          >
            All
          </Badge>
        </Link>
        <div className="w-px bg-border mx-1" />
        <Link href={`/escalations?status=${statusFilter}&urgency=high`}>
          <Badge
            variant={urgencyFilter === "high" ? "default" : "outline"}
            className="cursor-pointer bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          >
            High
          </Badge>
        </Link>
        <Link href={`/escalations?status=${statusFilter}&urgency=medium`}>
          <Badge
            variant={urgencyFilter === "medium" ? "default" : "outline"}
            className="cursor-pointer bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
          >
            Medium
          </Badge>
        </Link>
        {urgencyFilter && (
          <Link href={`/escalations?status=${statusFilter}`}>
            <Badge variant="outline" className="cursor-pointer">
              Clear urgency
            </Badge>
          </Link>
        )}
      </div>

      {/* Escalation List */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {statusFilter === "open" ? "Open" : statusFilter === "resolved" ? "Resolved" : "All"} Escalations
            <Badge variant="secondary" className="ml-1">{escalations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {escalations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
              <h3 className="font-medium text-lg">No open escalations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your AI is handling everything smoothly
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {escalations.map((esc) => {
                const urg = urgencyConfig[esc.urgency] || urgencyConfig.medium;
                return (
                  <div key={esc.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    {/* Urgency indicator */}
                    <div className="shrink-0">
                      <Badge className={urg.className}>{urg.label}</Badge>
                    </div>

                    {/* Lead info + reason */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {esc.lead_name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          +{esc.whatsapp_number}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {esc.reason}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {timeAgo(esc.created_at)}
                    </div>

                    {/* Status */}
                    {esc.resolved === 1 ? (
                      <Badge variant="secondary" className="shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resolved
                      </Badge>
                    ) : (
                      <ResolveButton escalationId={esc.id} />
                    )}

                    {/* View conversation */}
                    <Link href={`/conversations/${esc.lead_id}`}>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
