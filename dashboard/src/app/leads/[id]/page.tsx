import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  Calendar,
  AlertTriangle,
  Brain,
  Tag,
  StickyNote,
  ShieldX,
  PhoneCall,
  Flag,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import {
  getDB,
  getLeadWithSummary,
  getConversationEvents,
  getLeadEscalations,
  getLeadAppointments,
  getLeadCallbacks,
} from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { notFound, redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";

export const dynamic = "force-dynamic";

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

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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

const urgencyConfig: Record<string, { className: string }> = {
  high: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  medium: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

export default async function LeadProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const { id } = await params;
  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);
  const leadData = await getLeadWithSummary(db, id);

  if (!leadData) notFound();
  if (leadData.lead.business_id !== businessId) notFound();

  const { lead, summary } = leadData;

  const [events, escalations, appointments, callbacks] = await Promise.all([
    getConversationEvents(db, id),
    getLeadEscalations(db, id),
    getLeadAppointments(db, id),
    getLeadCallbacks(db, id),
  ]);

  // Parse JSON fields
  let interests: string[] = [];
  try {
    interests = summary?.key_interests ? JSON.parse(summary.key_interests) : [];
    if (!Array.isArray(interests)) interests = [];
  } catch { interests = []; }

  let objections: string[] = [];
  try {
    objections = summary?.objections ? JSON.parse(summary.objections) : [];
    if (!Array.isArray(objections)) objections = [];
  } catch { objections = []; }

  let tags: string[] = [];
  try {
    tags = lead.tags ? JSON.parse(lead.tags) : [];
    if (!Array.isArray(tags)) tags = [];
  } catch { tags = []; }

  const daysSinceFirst = Math.floor(
    (Date.now() / 1000 - lead.first_contact) / 86400
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4">
        <Link href="/leads">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-lg">
            {lead.name
              ? lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
              : lead.whatsapp_number.slice(-2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{lead.name || "Unknown"}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 font-mono">
              <Phone className="h-3 w-3" />+{lead.whatsapp_number}
            </span>
            {lead.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />{lead.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${getScoreColor(lead.score)}`}>
            {lead.score}
          </span>
          {getStatusBadge(lead.status)}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Left Column */}
        <div className="space-y-4">
          {/* Activity Summary */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{lead.message_count}</p>
                  <p className="text-xs text-muted-foreground">Messages</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{daysSinceFirst}</p>
                  <p className="text-xs text-muted-foreground">Days active</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{escalations.length}</p>
                  <p className="text-xs text-muted-foreground">Escalations</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{appointments.length + callbacks.length}</p>
                  <p className="text-xs text-muted-foreground">Bookings</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                <span>First contact: {formatDate(lead.first_contact)}</span>
                <span>Last active: {timeAgo(lead.last_contact)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Conversation History */}
          <Card>
            <CardHeader className="py-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversation ({events.length} messages)
              </CardTitle>
              <Link href={`/conversations/${lead.id}`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  View full thread
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {events.slice(-20).map((event) => (
                    <div key={event.id} className="flex gap-2 text-sm">
                      <span className="text-xs text-muted-foreground shrink-0 w-16 pt-0.5">
                        {formatTime(event.timestamp)}
                      </span>
                      <div className="flex-1 min-w-0">
                        {event.user_message && (
                          <p className="text-muted-foreground truncate">
                            <span className="font-medium text-foreground">Customer:</span>{" "}
                            {event.user_message}
                          </p>
                        )}
                        {event.agent_response && (
                          <p className="text-muted-foreground truncate">
                            <span className="font-medium text-primary">AI:</span>{" "}
                            {event.agent_response}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 h-5">
                        {event.action.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Escalation History */}
          {escalations.length > 0 && (
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Escalations ({escalations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {escalations.map((esc) => {
                    const urg = urgencyConfig[esc.urgency] || urgencyConfig.medium;
                    return (
                      <div key={esc.id} className="flex items-center gap-3">
                        <Badge className={urg.className}>{esc.urgency}</Badge>
                        <p className="text-sm flex-1 truncate">{esc.reason}</p>
                        {esc.resolved ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Resolved
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Open</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(esc.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appointments & Callbacks */}
          {(appointments.length > 0 || callbacks.length > 0) && (
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Bookings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {appointments.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 text-sm">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{apt.requested_date} {apt.requested_time}</span>
                    <Badge variant="outline" className="text-xs">{apt.status}</Badge>
                    {apt.notes && (
                      <span className="text-muted-foreground truncate">{apt.notes}</span>
                    )}
                  </div>
                ))}
                {callbacks.map((cb) => (
                  <div key={cb.id} className="flex items-center gap-3 text-sm">
                    <PhoneCall className="h-3 w-3 text-muted-foreground" />
                    <span>Callback: {cb.preferred_time || "No time specified"}</span>
                    <Badge variant="outline" className="text-xs">{cb.status}</Badge>
                    {cb.reason && (
                      <span className="text-muted-foreground truncate">{cb.reason}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Lead Info */}
          <Card>
            <CardHeader className="py-1.5">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Lead Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(lead.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <span className={`font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Messages</span>
                <span className="text-sm">{lead.message_count}</span>
              </div>
              {interests.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Interests</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {interests.map((interest) => (
                        <Badge key={interest} variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {objections.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <ShieldX className="h-3 w-3" /> Objections
                    </span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {objections.map((obj) => (
                        <Badge key={obj} variant="outline" className="text-xs border-red-200 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20">
                          {obj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Tag className="h-3 w-3" /> Tags
                    </span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
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
              {lead.notes && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <StickyNote className="h-3 w-3" /> Notes
                    </span>
                    <p className="text-sm mt-1 text-muted-foreground italic">{lead.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Summary */}
          {summary?.summary && (
            <Card>
              <CardHeader className="py-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" /> AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.summary}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
