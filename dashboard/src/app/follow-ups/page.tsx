import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, Clock, Eye } from "lucide-react";
import Link from "next/link";
import { getDB, getFollowUps, getFollowUpStats } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { StatsCard } from "@/components/dashboard/stats-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { BlurFade } from "@/components/ui/blur-fade";

export const dynamic = "force-dynamic";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const page = parseInt(sp.page || "1", 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const [{ followUps, total }, stats] = await Promise.all([
    getFollowUps(db, businessId, { limit, offset }),
    getFollowUpStats(db, businessId),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Follow-up Tracking
          </h1>
          <p className="text-muted-foreground">
            Automated follow-ups sent to leads and their engagement
          </p>
        </div>
      </BlurFade>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Sent"
          value={stats.totalSent}
          description="Follow-ups delivered"
          iconName="message-square"
          delay={0}
        />
        <StatsCard
          title="Unique Leads"
          value={stats.uniqueLeads}
          description="Leads contacted"
          iconName="users"
          delay={0.05}
        />
        <StatsCard
          title="Responded"
          value={stats.responded}
          description="Leads who replied"
          iconName="trending-up"
          delay={0.1}
        />
        <StatsCard
          title="Response Rate"
          value={stats.responseRate}
          suffix="%"
          description="Lead re-engagement"
          iconName="activity"
          delay={0.15}
        />
      </div>

      <BlurFade delay={0.2}>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Follow-ups
              <Badge variant="secondary" className="ml-1">
                {total}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Send className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium text-lg">No follow-ups sent yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable smart follow-ups in{" "}
                  <Link
                    href="/settings"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Settings
                  </Link>{" "}
                  to get started
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {followUps.map((fu) => {
                  const responded = fu.lead_last_contact > fu.created_at;
                  return (
                    <div
                      key={fu.id}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {fu.lead_name || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            +{fu.whatsapp_number}
                          </span>
                          {responded && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            >
                              Replied
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {fu.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {timeAgo(fu.created_at)}
                      </div>
                      <Link href={`/conversations/${fu.lead_id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
