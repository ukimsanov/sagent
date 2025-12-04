import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getDB,
  getAnalyticsSummary,
  getMessageEvents,
  getIntentBreakdown,
  getLeadFunnelMetrics,
  getTopSearchQueries,
  ResponseAction
} from "@/lib/db";
import { StatsCard } from "@/components/dashboard/stats-card";
import { AnimatedSection } from "@/components/dashboard/animated-section";
import { AnimatedProgress } from "@/components/dashboard/animated-progress";
import { ActivityItem } from "@/components/dashboard/activity-item";
import { BlurFade } from "@/components/ui/blur-fade";
import { LandingPage } from "@/components/landing-page";
import { withAuth } from "@workos-inc/authkit-nextjs";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

// Default business ID for demo (will be replaced with org-based ID after auth)
const BUSINESS_ID = "demo-store-001";

function getActionColor(action: string) {
  const colors: Record<string, string> = {
    show_products: "bg-chart-1/10 text-chart-1",
    ask_clarification: "bg-chart-3/10 text-chart-3",
    answer_question: "bg-chart-2/10 text-chart-2",
    empathize: "bg-chart-4/10 text-chart-4",
    greet: "bg-chart-5/10 text-chart-5",
    thank: "bg-chart-2/10 text-chart-2",
    handoff: "bg-destructive/10 text-destructive",
    farewell: "bg-muted text-muted-foreground",
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

function maskPhone(phone: string) {
  if (phone.length >= 4) {
    return `+1 xxx-xxx-${phone.slice(-4)}`;
  }
  return phone;
}

export default async function DashboardPage() {
  // Check authentication - show landing page if not signed in
  const { user } = await withAuth();

  if (!user) {
    return <LandingPage />;
  }

  const db = await getDB();

  // Get analytics for the last 24 hours
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const stats = await getAnalyticsSummary(db, BUSINESS_ID, oneDayAgo, now);
  const recentEvents = await getMessageEvents(db, BUSINESS_ID, { limit: 10 });
  const intentBreakdown = await getIntentBreakdown(db, BUSINESS_ID, oneDayAgo, now);
  const leadFunnel = await getLeadFunnelMetrics(db, BUSINESS_ID);
  const topSearches = await getTopSearchQueries(db, BUSINESS_ID, oneDayAgo, now);

  const totalLeads = Object.values(leadFunnel).reduce((a, b) => a + b, 0);

  // Calculate response time in seconds for display
  const responseTimeSeconds = stats.avgProcessingTime > 0
    ? stats.avgProcessingTime / 1000
    : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Analytics for the last 24 hours
          </p>
        </div>
      </BlurFade>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Messages"
          value={stats.totalMessages}
          description="Live data"
          iconName="message-square"
          delay={0.05}
        />
        <StatsCard
          title="Unique Leads"
          value={stats.uniqueLeads}
          description="Active conversations"
          iconName="users"
          delay={0.1}
        />
        <StatsCard
          title="Avg Response Time"
          value={responseTimeSeconds}
          suffix="s"
          description="Processing time per message"
          iconName="clock"
          delay={0.15}
          decimalPlaces={1}
        />
        <StatsCard
          title="Handoff Rate"
          value={stats.handoffRate}
          suffix="%"
          description="Escalated to human"
          iconName="alert-circle"
          delay={0.2}
        />
      </div>

      {/* Action breakdown and recent activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Action breakdown */}
        <AnimatedSection title="Action Breakdown" delay={0.25}>
          <div className="space-y-3">
            {(Object.entries(stats.actionBreakdown) as [ResponseAction, number][])
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count], index) => {
                const percentage = stats.totalMessages > 0
                  ? Math.round((count / stats.totalMessages) * 100)
                  : 0;
                return (
                  <BlurFade key={action} delay={0.3 + index * 0.05} direction="left">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className={getActionColor(action)}>
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
            {stats.totalMessages === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activity in the last 24 hours
              </p>
            )}
          </div>
        </AnimatedSection>

        {/* Recent activity */}
        <AnimatedSection
          title="Recent Activity"
          delay={0.3}
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
                    delay={0.35 + index * 0.03}
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

      {/* Per-tenant analytics widgets */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Lead Funnel */}
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

        {/* Intent Breakdown */}
        <AnimatedSection title="Customer Intents" delay={0.5}>
          <div className="space-y-2">
            {intentBreakdown.length > 0 ? (
              intentBreakdown.slice(0, 6).map((item, index) => (
                <BlurFade key={item.intent_type} delay={0.55 + index * 0.04} direction="left">
                  <div className="flex items-center justify-between hover:bg-muted/30 rounded px-2 py-1 -mx-2 transition-colors">
                    <span className="text-sm truncate flex-1">
                      {item.intent_type.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {item.count}
                    </Badge>
                  </div>
                </BlurFade>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No intent data yet
              </p>
            )}
          </div>
        </AnimatedSection>

        {/* Top Searches */}
        <AnimatedSection title="Top Product Searches" delay={0.6}>
          <div className="space-y-2">
            {topSearches.length > 0 ? (
              topSearches.slice(0, 6).map((item, index) => (
                <BlurFade key={item.search_query} delay={0.65 + index * 0.04} direction="left">
                  <div className="flex items-center gap-2 hover:bg-muted/30 rounded px-2 py-1 -mx-2 transition-colors">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                    <span className="text-sm truncate flex-1">{item.search_query}</span>
                    <span className="text-xs text-muted-foreground">{item.count}x</span>
                  </div>
                </BlurFade>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No search data yet
              </p>
            )}
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
