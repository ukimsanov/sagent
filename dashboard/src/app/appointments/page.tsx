import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react";
import Link from "next/link";
import { getDB, getAppointments, getCallbackRequests } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { CallbackActions } from "@/components/appointments/callback-actions";

export const dynamic = "force-dynamic";

function formatCreatedAt(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusConfig: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Pending" },
  confirmed: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Confirmed" },
  cancelled: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Cancelled" },
  completed: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Completed" },
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const [appointments, callbacks] = await Promise.all([
    getAppointments(db, businessId),
    getCallbackRequests(db, businessId),
  ]);

  const activeTab = sp.tab || "appointments";
  const pendingAppointments = appointments.filter((a) => a.status === "pending").length;
  const pendingCallbacks = callbacks.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appointments & Callbacks</h1>
        <p className="text-muted-foreground">
          Manage customer bookings and callback requests
        </p>
      </div>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="appointments" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Appointments
            {pendingAppointments > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingAppointments}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="gap-1.5">
            <Phone className="h-4 w-4" />
            Callbacks
            {pendingCallbacks > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingCallbacks}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Appointments
                <Badge variant="secondary">{appointments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium">No appointments yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    When customers book appointments through the AI agent, they will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {appointments.map((apt) => {
                    const status = statusConfig[apt.status] || statusConfig.pending;
                    return (
                      <div key={apt.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="shrink-0">
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {apt.lead_name || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              +{apt.whatsapp_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {apt.requested_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {apt.requested_date}
                              </span>
                            )}
                            {apt.requested_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {apt.requested_time}
                              </span>
                            )}
                          </div>
                          {apt.notes && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {apt.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatCreatedAt(apt.created_at)}
                        </div>
                        {apt.status === "pending" && (
                          <AppointmentActions appointmentId={apt.id} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Callbacks Tab */}
        <TabsContent value="callbacks" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Callback Requests
                <Badge variant="secondary">{callbacks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {callbacks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Phone className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium">No callback requests</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    When customers request callbacks through the AI agent, they will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {callbacks.map((cb) => {
                    const status = statusConfig[cb.status] || statusConfig.pending;
                    return (
                      <div key={cb.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="shrink-0">
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {cb.lead_name || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              +{cb.whatsapp_number}
                            </span>
                          </div>
                          {cb.preferred_time && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Preferred: {cb.preferred_time}
                            </p>
                          )}
                          {cb.reason && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {cb.reason}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatCreatedAt(cb.created_at)}
                        </div>
                        {cb.status === "pending" && (
                          <CallbackActions callbackId={cb.id} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
