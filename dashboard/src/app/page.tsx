import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import {
  getDB,
  getAnalyticsSummary,
  getMessageEvents,
  getIntentBreakdown,
  getLeadFunnelMetrics,
  getTopSearchQueries,
  ResponseAction
} from "@/lib/db";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

// Default business ID for demo
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
  // Format: +1 xxx-xxx-4567
  if (phone.length >= 4) {
    return `+1 xxx-xxx-${phone.slice(-4)}`;
  }
  return phone;
}

export default async function DashboardPage() {
  const db = await getDB();

  // Get analytics for the last 24 hours
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const stats = await getAnalyticsSummary(db, BUSINESS_ID, oneDayAgo, now);
  const recentEvents = await getMessageEvents(db, BUSINESS_ID, { limit: 5 });
  const intentBreakdown = await getIntentBreakdown(db, BUSINESS_ID, oneDayAgo, now);
  const leadFunnel = await getLeadFunnelMetrics(db, BUSINESS_ID);
  const topSearches = await getTopSearchQueries(db, BUSINESS_ID, oneDayAgo, now);

  const totalLeads = Object.values(leadFunnel).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Analytics for the last 24 hours
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-chart-2 inline-flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                Live data
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueLeads}</div>
            <p className="text-xs text-muted-foreground">
              Active conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgProcessingTime > 0
                ? `${(stats.avgProcessingTime / 1000).toFixed(1)}s`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Processing time per message
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Handoff Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.handoffRate}%</div>
            <p className="text-xs text-muted-foreground">
              Escalated to human
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action breakdown and recent activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Action breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Action Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(Object.entries(stats.actionBreakdown) as [ResponseAction, number][])
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => {
                  const percentage = stats.totalMessages > 0
                    ? Math.round((count / stats.totalMessages) * 100)
                    : 0;
                  return (
                    <div key={action} className="flex items-center gap-3">
                      <Badge variant="secondary" className={getActionColor(action)}>
                        {action.replace(/_/g, " ")}
                      </Badge>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              {stats.totalMessages === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity in the last 24 hours
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Link
              href="/conversations"
              className="text-sm text-primary hover:underline inline-flex items-center"
            >
              View all
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEvents.events.length > 0 ? (
                recentEvents.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono">{maskPhone(event.lead_id)}</span>
                      <Badge variant="secondary" className={getActionColor(event.action)}>
                        {event.action.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(event.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-tenant analytics widgets */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Lead Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { status: "new", label: "New", color: "bg-slate-400" },
                { status: "engaged", label: "Engaged", color: "bg-chart-5" },
                { status: "warm", label: "Warm", color: "bg-chart-3" },
                { status: "hot", label: "Hot", color: "bg-chart-4" },
                { status: "converted", label: "Converted", color: "bg-chart-2" },
              ].map(({ status, label, color }) => {
                const count = leadFunnel[status] || 0;
                const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span className="text-xs w-20">{label}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
              {totalLeads === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No leads yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Intent Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Intents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {intentBreakdown.length > 0 ? (
                intentBreakdown.slice(0, 6).map((item) => (
                  <div key={item.intent_type} className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1">
                      {item.intent_type.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {item.count}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No intent data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Searches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Product Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topSearches.length > 0 ? (
                topSearches.slice(0, 6).map((item, index) => (
                  <div key={item.search_query} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                    <span className="text-sm truncate flex-1">{item.search_query}</span>
                    <span className="text-xs text-muted-foreground">{item.count}x</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No search data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
