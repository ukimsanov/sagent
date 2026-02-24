import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MessageSquare,
  Package,
  HelpCircle,
  AlertTriangle,
  User,
  TrendingUp,
  Flag,
} from "lucide-react";
import Link from "next/link";
import { getDB, getConversationEvents, getLeadWithSummary } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { notFound, redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

const actionIcons: Record<string, typeof Package> = {
  show_products: Package,
  ask_clarification: HelpCircle,
  answer_question: MessageSquare,
  empathize: AlertTriangle,
  greet: MessageSquare,
  thank: MessageSquare,
  handoff: Flag,
};

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

function getStatusBadge(status: string) {
  const variants: Record<
    string,
    { variant: "default" | "secondary" | "destructive" | "outline"; className: string }
  > = {
    new: { variant: "outline", className: "" },
    engaged: { variant: "secondary", className: "bg-chart-5/10 text-chart-5" },
    warm: { variant: "secondary", className: "bg-chart-3/10 text-chart-3" },
    hot: { variant: "secondary", className: "bg-chart-4/10 text-chart-4" },
    converted: { variant: "secondary", className: "bg-chart-2/10 text-chart-2" },
    lost: { variant: "secondary", className: "bg-muted text-muted-foreground" },
  };
  const style = variants[status] || variants.new;
  return (
    <Badge variant={style.variant} className={style.className}>
      {status}
    </Badge>
  );
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-chart-4";
  if (score >= 50) return "text-chart-3";
  if (score >= 20) return "text-chart-5";
  return "text-muted-foreground";
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Check authentication
  const { user } = await withAuth();
  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);
  const leadData = await getLeadWithSummary(db, id);

  if (!leadData) {
    notFound();
  }

  // Verify the lead belongs to the user's business
  if (leadData.lead.business_id !== businessId) {
    notFound();
  }

  const { lead, summary } = leadData;
  const events = await getConversationEvents(db, id);

  // Parse interests from summary if available
  let interests: string[] = [];
  try {
    interests = summary?.key_interests ? JSON.parse(summary.key_interests) : [];
    if (!Array.isArray(interests)) interests = [];
  } catch {
    interests = [];
  }

  // Group events into messages (user + agent pairs)
  const messages = events.map((event) => ({
    id: event.id,
    userMessage: event.user_message,
    agentResponse: event.agent_response,
    timestamp: event.timestamp,
    action: event.action,
    intentType: event.intent_type,
    flagged: event.flagged_for_human === 1,
  }));

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4">
        <Link href="/conversations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {lead.name
                ? lead.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                : lead.whatsapp_number.slice(-2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold">
              {lead.name || "Unknown"}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              +{lead.whatsapp_number}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(lead.status)}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 260px" }}>
        {/* Message Thread */}
        <Card>
          <CardHeader className="py-1.5 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversation ({messages.length})
            </CardTitle>
          </CardHeader>
            <CardContent className="py-4 space-y-4">
              {messages.length > 0 ? (
                messages.map((message, index) => {
                  const showDate =
                    index === 0 ||
                    formatDate(message.timestamp) !==
                      formatDate(messages[index - 1].timestamp);

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <Badge variant="secondary" className="text-xs">
                            {formatDate(message.timestamp)}
                          </Badge>
                        </div>
                      )}
                      {/* User message */}
                      {message.userMessage && (
                        <div className="flex justify-start mb-2">
                          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-muted rounded-bl-md">
                            <p className="text-sm whitespace-pre-wrap">{message.userMessage}</p>
                            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                              <span className="text-xs">{formatTime(message.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Agent response */}
                      {message.agentResponse && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground rounded-br-md">
                            <p className="text-sm whitespace-pre-wrap">{message.agentResponse}</p>
                            <div className="flex items-center gap-2 mt-1 text-primary-foreground/70">
                              <span className="text-xs">{formatTime(message.timestamp)}</span>
                              {message.action && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-primary-foreground/30 text-primary-foreground/70"
                                >
                                  {message.action.replace(/_/g, " ")}
                                </Badge>
                              )}
                              {message.flagged && (
                                <Badge variant="destructive" className="text-xs">
                                  Flagged
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No messages in this conversation
                </p>
              )}
            </CardContent>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Lead Info */}
          <Card>
            <CardHeader className="py-1.5">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Lead Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="w-[70px] flex justify-center">
                  {getStatusBadge(lead.status)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <div className="w-[70px] flex justify-center">
                  <span className={`font-bold ${getScoreColor(lead.score)}`}>
                    {lead.score}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Messages</span>
                <div className="w-[70px] flex justify-center">
                  <span className="text-sm">{lead.message_count}</span>
                </div>
              </div>
              {interests.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Interests</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {interests.map((interest) => (
                        <Badge key={interest} variant="outline" className="text-xs">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {summary?.next_steps && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Next Steps</span>
                    <p className="text-sm mt-1">{summary.next_steps}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Event Timeline */}
          <Card>
            <CardHeader className="py-1.5">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Actions Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="space-y-3">
                {events.slice(0, 10).map((event, index) => {
                  const Icon = actionIcons[event.action] || MessageSquare;
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <Icon className="h-3 w-3" />
                        </div>
                        {index < Math.min(events.length, 10) - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-sm font-medium">
                          {event.action.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.intent_type?.replace(/_/g, " ") || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No actions recorded
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
