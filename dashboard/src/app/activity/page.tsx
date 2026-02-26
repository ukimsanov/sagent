import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Eye,
  MessageSquare,
  AlertTriangle,
  Package,
  HelpCircle,
  Flag,
} from "lucide-react";
import Link from "next/link";
import { getDB, getActivityFeed } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { getActionColor } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";

export const dynamic = "force-dynamic";

const actionIcons: Record<string, typeof Activity> = {
  show_products: Package,
  ask_clarification: HelpCircle,
  answer_question: MessageSquare,
  empathize: AlertTriangle,
  greet: MessageSquare,
  thank: MessageSquare,
  handoff: Flag,
  human_reply: MessageSquare,
};

const actionTypes = [
  "show_products",
  "ask_clarification",
  "answer_question",
  "handoff",
  "empathize",
  "human_reply",
];

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

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const page = parseInt(sp.page || "1", 10);
  const actionFilter = sp.action;
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const { events, total } = await getActivityFeed(db, businessId, {
    limit,
    offset,
    action: actionFilter,
  });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Feed</h1>
          <p className="text-muted-foreground">
            Real-time system events and agent actions
          </p>
        </div>
      </BlurFade>

      {/* Action type filters */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap gap-2">
          <Link href="/activity">
            <Badge
              variant={!actionFilter ? "default" : "outline"}
              className="cursor-pointer"
            >
              All
            </Badge>
          </Link>
          {actionTypes.map((a) => (
            <Link key={a} href={`/activity?action=${a}`}>
              <Badge
                variant={actionFilter === a ? "default" : "outline"}
                className="cursor-pointer"
              >
                {a.replace(/_/g, " ")}
              </Badge>
            </Link>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.15}>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Events
              <Badge variant="secondary" className="ml-1">
                {total}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium text-lg">No events found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Events will appear here as the AI agent processes messages
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {events.map((event) => {
                  const Icon = actionIcons[event.action] || Activity;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {event.lead_name || "Unknown"}
                          </span>
                          <Badge
                            variant="secondary"
                            className={getActionColor(event.action)}
                          >
                            {event.action.replace(/_/g, " ")}
                          </Badge>
                          {event.flagged_for_human === 1 && (
                            <Badge variant="destructive" className="text-xs">
                              Flagged
                            </Badge>
                          )}
                          {event.sentiment && (
                            <Badge variant="outline" className="text-xs">
                              {event.sentiment}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {event.user_message ||
                            event.intent_type?.replace(/_/g, " ") ||
                            "---"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo(event.timestamp)}
                      </span>
                      <Link href={`/conversations/${event.lead_id}`}>
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
