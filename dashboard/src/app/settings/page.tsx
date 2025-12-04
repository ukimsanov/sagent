import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDB, getBusinessById } from "@/lib/db";
import { SettingsForm } from "./settings-form";

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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Business not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your WhatsApp AI agent behavior
        </p>
      </div>

      <div className="grid gap-6">
        {/* Brand Voice */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Voice</CardTitle>
            <CardDescription>
              Customize how the AI agent communicates with customers
            </CardDescription>
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

        {/* Handoff Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Human Handoff</CardTitle>
            <CardDescription>
              Configure when and how conversations are escalated to your team
            </CardDescription>
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

        {/* Store Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Store Hours</CardTitle>
            <CardDescription>
              Set your business hours and after-hours message
            </CardDescription>
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
      </div>
    </div>
  );
}
