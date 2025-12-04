import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDB, getBusinessById } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { BlurFade } from "@/components/ui/blur-fade";
import { MessageSquare, Users, Clock, Settings } from "lucide-react";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

// Default business ID for demo
const BUSINESS_ID = "demo-store-001";

export default async function SettingsPage() {
  const db = await getDB();
  const business = await getBusinessById(db, BUSINESS_ID);

  if (!business) {
    return (
      <div className="space-y-6">
        <BlurFade delay={0}>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Business not found</p>
          </div>
        </BlurFade>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure your WhatsApp AI agent behavior
            </p>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6">
        {/* Brand Voice */}
        <BlurFade delay={0.1}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-chart-5/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-chart-5" />
                </div>
                <div>
                  <CardTitle>Brand Voice</CardTitle>
                  <CardDescription>
                    Customize how the AI agent communicates with customers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SettingsForm
                businessId={business.id}
                section="brand"
                initialData={{
                  brand_tone: business.brand_tone || "friendly",
                  greeting_template: business.greeting_template || "",
                }}
              />
            </CardContent>
          </Card>
        </BlurFade>

        {/* Handoff Settings */}
        <BlurFade delay={0.2}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-chart-4" />
                </div>
                <div>
                  <CardTitle>Human Handoff</CardTitle>
                  <CardDescription>
                    Configure when and how conversations are escalated to your team
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SettingsForm
                businessId={business.id}
                section="handoff"
                initialData={{
                  handoff_email: business.handoff_email || "",
                  handoff_phone: business.handoff_phone || "",
                  auto_handoff_threshold: business.auto_handoff_threshold || 3,
                  escalation_keywords: business.escalation_keywords || "",
                }}
              />
            </CardContent>
          </Card>
        </BlurFade>

        {/* Store Hours */}
        <BlurFade delay={0.3}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-chart-3" />
                </div>
                <div>
                  <CardTitle>Store Hours</CardTitle>
                  <CardDescription>
                    Set your business hours and after-hours message
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SettingsForm
                businessId={business.id}
                section="hours"
                initialData={{
                  timezone: business.timezone || "America/New_York",
                  working_hours: business.working_hours || "",
                  after_hours_message: business.after_hours_message || "",
                }}
              />
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </div>
  );
}
