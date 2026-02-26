import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { getDB, getSystemMetrics, getDlqStats, getDlqEntries } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DlqResolveButton } from "@/components/system/dlq-resolve-button";
import { BlurFade } from "@/components/ui/blur-fade";

export const dynamic = "force-dynamic";

function timeAgo(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function SystemPage() {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const [metrics, dlqStats, dlqEntries] = await Promise.all([
    getSystemMetrics(db, businessId),
    getDlqStats(db),
    getDlqEntries(db, { limit: 25 }),
  ]);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">
            Monitor system performance and errors
          </p>
        </div>
      </BlurFade>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Messages Today"
          value={metrics.messagesToday}
          description="Processed in last 24h"
          iconName="message-square"
          delay={0}
        />
        <StatsCard
          title="Avg Response Time"
          value={metrics.avgResponseTime}
          suffix="ms"
          description="Processing latency"
          iconName="clock"
          delay={0.05}
        />
        <StatsCard
          title="Errors Today"
          value={metrics.errorsToday}
          description="Dead letter entries"
          iconName="alert-circle"
          delay={0.1}
        />
        <StatsCard
          title="Unresolved"
          value={dlqStats.unresolved}
          description="Pending resolution"
          iconName="shield-check"
          delay={0.15}
        />
      </div>

      {/* Error type breakdown */}
      {Object.keys(dlqStats.byType).length > 0 && (
        <BlurFade delay={0.2}>
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Errors by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dlqStats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-sm">
                    {type.replace(/_/g, " ")}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      )}

      {/* Recent DLQ entries */}
      <BlurFade delay={0.25}>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Recent Errors
              <Badge variant="secondary" className="ml-1">
                {dlqEntries.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dlqEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-10 w-10 text-emerald-500 mb-3" />
                <h3 className="font-medium text-lg">No unresolved errors</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  System is running smoothly
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {dlqEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <Badge variant="outline" className="shrink-0">
                      {entry.operation_type.replace(/_/g, " ")}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.error_message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Entity: {entry.entity_id} | Retries:{" "}
                        {entry.retry_count}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(entry.created_at)}
                    </span>
                    <DlqResolveButton entryId={entry.id} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
