import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getDB,
  getAnalyticsSummaryWithComparison,
  getMessageEvents,
  getIntentBreakdown,
  getLeadFunnelMetrics,
  getTopSearchQueries,
  getTimeSeriesData,
  getPeakHoursData,
  ResponseAction,
} from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { StatsCard } from "@/components/dashboard/stats-card";
import { AnimatedSection } from "@/components/dashboard/animated-section";
import { AnimatedProgress } from "@/components/dashboard/animated-progress";
import { ActivityItem } from "@/components/dashboard/activity-item";
import { MessagesChart } from "@/components/dashboard/messages-chart";
import { IntentBarChart } from "@/components/dashboard/intent-bar-chart";
import { PeakHoursHeatmap } from "@/components/dashboard/peak-hours-heatmap";
import { SearchBarChart } from "@/components/dashboard/search-bar-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { parseRange, rangeToMs, rangeLabel } from "@/lib/date-range";
import { BlurFade } from "@/components/ui/blur-fade";
import { LandingPage } from "@/components/landing";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActionColor, maskPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await withAuth();

  if (!user) {
    return <LandingPage />;
  }

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  // Parse date range from URL
  const params = await searchParams;
  const rangeParam = typeof params.range === "string" ? params.range : null;
  const range = parseRange(rangeParam);
  const now = Date.now();
  const startTime = now - rangeToMs(range);

  // Fetch all data in parallel
  const [
    analytics,
    recentEvents,
    intentBreakdown,
    leadFunnel,
    topSearches,
    timeSeries,
    peakHours,
  ] = await Promise.all([
    getAnalyticsSummaryWithComparison(db, businessId, startTime, now),
    getMessageEvents(db, businessId, { limit: 10 }),
    getIntentBreakdown(db, businessId, startTime, now),
    getLeadFunnelMetrics(db, businessId),
    getTopSearchQueries(db, businessId, startTime, now),
    getTimeSeriesData(db, businessId, startTime, now),
    getPeakHoursData(db, businessId, startTime, now),
  ]);

  const totalLeads = Object.values(leadFunnel).reduce((a, b) => a + b, 0);

  const responseTimeSeconds =
    analytics.current.avgProcessingTime > 0
      ? analytics.current.avgProcessingTime / 1000
      : 0;

  const prevResponseTimeSeconds =
    analytics.previous.avgProcessingTime > 0
      ? analytics.previous.avgProcessingTime / 1000
      : 0;

  // Response time change: invert color since lower is better
  const responseTimeChange =
    prevResponseTimeSeconds > 0
      ? Math.round(
          ((responseTimeSeconds - prevResponseTimeSeconds) /
            prevResponseTimeSeconds) *
            100
        )
      : 0;

  const periodLabel = rangeLabel(range);

  return (
    <div className="space-y-6">
      {/* Page header with date range picker */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">
              Analytics for {periodLabel.toLowerCase()}
            </p>
          </div>
          <Suspense>
            <DateRangePicker />
          </Suspense>
        </div>
      </BlurFade>

      {/* KPI Cards with comparison arrows */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Messages"
          value={analytics.current.totalMessages}
          description={`vs previous ${periodLabel.toLowerCase()}`}
          iconName="message-square"
          delay={0.05}
          change={analytics.changes.totalMessages}
        />
        <StatsCard
          title="Unique Leads"
          value={analytics.current.uniqueLeads}
          description={`vs previous ${periodLabel.toLowerCase()}`}
          iconName="users"
          delay={0.1}
          change={analytics.changes.uniqueLeads}
        />
        <StatsCard
          title="Avg Response Time"
          value={responseTimeSeconds}
          suffix="s"
          description={`vs previous ${periodLabel.toLowerCase()}`}
          iconName="clock"
          delay={0.15}
          decimalPlaces={1}
          change={responseTimeChange}
          invertColor={true}
        />
        <StatsCard
          title="AI Resolution Rate"
          value={analytics.current.resolutionRate}
          suffix="%"
          description={`vs previous ${periodLabel.toLowerCase()}`}
          iconName="shield-check"
          delay={0.2}
          change={analytics.changes.resolutionRate}
        />
      </div>

      {/* Main chart: Messages over time */}
      <BlurFade delay={0.25}>
        <MessagesChart data={timeSeries} />
      </BlurFade>

      {/* Side-by-side: Intents + Peak Hours */}
      <div className="grid gap-4 md:grid-cols-2">
        <BlurFade delay={0.3}>
          <IntentBarChart data={intentBreakdown} />
        </BlurFade>
        <BlurFade delay={0.35}>
          <PeakHoursHeatmap data={peakHours} />
        </BlurFade>
      </div>

      {/* Side-by-side: Lead Funnel + Top Searches */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatedSection title="Lead Funnel" delay={0.4}>
          <div className="space-y-2">
            {[
              { status: "new", label: "New", color: "bg-slate-400" },
              { status: "engaged", label: "Engaged", color: "bg-chart-5" },
              { status: "warm", label: "Warm", color: "bg-chart-3" },
              { status: "hot", label: "Hot", color: "bg-chart-4" },
              { status: "converted", label: "Converted", color: "bg-chart-2" },
            ].map(({ status, label, color }, index) => {
              const count = leadFunnel[status] || 0;
              return (
                <AnimatedProgress
                  key={status}
                  value={count}
                  max={totalLeads}
                  label={label}
                  color={color}
                  delay={0.45 + index * 0.05}
                />
              );
            })}
            {totalLeads === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No leads yet
              </p>
            )}
          </div>
        </AnimatedSection>

        <BlurFade delay={0.45}>
          <SearchBarChart data={topSearches} />
        </BlurFade>
      </div>

      {/* Action breakdown + Recent activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatedSection title="Action Breakdown" delay={0.5}>
          <div className="space-y-3">
            {(
              Object.entries(analytics.current.actionBreakdown) as [
                ResponseAction,
                number,
              ][]
            )
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count], index) => {
                const percentage =
                  analytics.current.totalMessages > 0
                    ? Math.round(
                        (count / analytics.current.totalMessages) * 100
                      )
                    : 0;
                return (
                  <BlurFade
                    key={action}
                    delay={0.55 + index * 0.05}
                    direction="left"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={getActionColor(action)}
                      >
                        {action.replace(/_/g, " ")}
                      </Badge>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count}
                      </span>
                    </div>
                  </BlurFade>
                );
              })}
            {analytics.current.totalMessages === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activity in this period
              </p>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection
          title="Recent Activity"
          delay={0.55}
          href="/conversations"
          linkText="View all"
        >
          <ScrollArea className="h-[280px] -mx-1 px-1">
            <div className="space-y-1">
              {recentEvents.events.length > 0 ? (
                recentEvents.events.map((event, index) => (
                  <ActivityItem
                    key={event.id}
                    phone={maskPhone(event.lead_id)}
                    action={event.action}
                    timeAgo={formatTimeAgo(event.timestamp)}
                    leadId={event.lead_id}
                    delay={0.6 + index * 0.03}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </ScrollArea>
        </AnimatedSection>
      </div>
    </div>
  );
}
