import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  User,
  Clock,
} from "lucide-react";
import { getDB, getPromoCodes, getPromoStats } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CreatePromoForm } from "@/components/promos/create-promo-form";
import { DeactivateButton } from "@/components/promos/deactivate-button";

export const dynamic = "force-dynamic";

function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return "No expiry";
  const date = new Date(expiresAt * 1000);
  const now = new Date();
  if (date < now) return "Expired";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isActive(promo: { used_by_lead_id: string | null; expires_at: number | null }): boolean {
  if (promo.used_by_lead_id) return false;
  if (promo.expires_at && promo.expires_at < Math.floor(Date.now() / 1000)) return false;
  return true;
}

export default async function PromosPage() {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const [promos, stats] = await Promise.all([
    getPromoCodes(db, businessId),
    getPromoStats(db, businessId),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promo Codes</h1>
          <p className="text-muted-foreground">
            Manage discount codes delivered by your AI agent
          </p>
        </div>
        <CreatePromoForm />
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <StatsCard
          title="Total Codes"
          value={stats.total}
          description="All promo codes"
          iconName="bar-chart"
          delay={0}
        />
        <StatsCard
          title="Used"
          value={stats.usedCount}
          description="Redeemed by customers"
          iconName="users"
          delay={0.05}
        />
        <StatsCard
          title="Active"
          value={stats.activeCount}
          description="Available for use"
          iconName="shield-check"
          delay={0.1}
        />
      </div>

      {/* Promo List */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            All Promo Codes
            <Badge variant="secondary">{promos.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ticket className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h3 className="font-medium">No promo codes yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create promo codes for your AI agent to distribute to customers
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {promos.map((promo) => {
                const active = isActive(promo);
                return (
                  <div key={promo.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    {/* Code */}
                    <div className="shrink-0">
                      <code className={`text-sm font-bold px-2 py-1 rounded ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {promo.code}
                      </code>
                    </div>

                    {/* Discount */}
                    <div className="shrink-0">
                      {promo.discount_percent ? (
                        <Badge variant="secondary">{promo.discount_percent}% off</Badge>
                      ) : promo.discount_amount ? (
                        <Badge variant="secondary">${promo.discount_amount} off</Badge>
                      ) : (
                        <Badge variant="outline">No discount set</Badge>
                      )}
                    </div>

                    {/* Usage info */}
                    <div className="flex-1 min-w-0">
                      {promo.used_by_lead_id ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          Used by {promo.used_by_name || "Unknown"}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unused</span>
                      )}
                    </div>

                    {/* Expiry */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatExpiry(promo.expires_at)}
                    </div>

                    {/* Status */}
                    <Badge variant={active ? "default" : "secondary"} className="shrink-0">
                      {active ? "Active" : promo.used_by_lead_id ? "Used" : "Expired"}
                    </Badge>

                    {/* Deactivate */}
                    {active && <DeactivateButton promoId={promo.id} />}
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
