"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2 } from "lucide-react";

type Section = "status" | "brand" | "handoff" | "hours";

const GREETING_MAX_LENGTH = 300;
const AFTER_HOURS_MAX_LENGTH = 500;

interface SettingsFormProps {
  businessId: string;
  section: Section;
  initialData: Record<string, string | number>;
}

export function SettingsForm({ businessId, section, initialData }: SettingsFormProps) {
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (key: string, value: string | number) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...data }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (section === "status") {
    const handleToggle = async (checked: boolean) => {
      const newValue = checked ? 1 : 0;
      setData((prev) => ({ ...prev, ai_enabled: newValue }));
      setSaving(true);

      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, ai_enabled: newValue }),
        });

        if (response.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } catch (error) {
        console.error("Failed to save settings:", error);
      } finally {
        setSaving(false);
      }
    };

    // comp-186 card switch pattern
    return (
      <div className="relative flex w-full items-start gap-2 rounded-md border border-input p-4 shadow-xs outline-none has-data-[state=checked]:border-primary/50">
        <Switch
          id="ai_enabled"
          aria-describedby="ai_enabled-description"
          className="data-[state=checked]:[&_span]:rtl:-translate-x-2 order-1 h-4 w-6 after:absolute after:inset-0 [&_span]:size-3 data-[state=checked]:[&_span]:translate-x-2"
          checked={data.ai_enabled === 1}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
        <div className="grid grow gap-2">
          <Label htmlFor="ai_enabled" className="flex items-center gap-2">
            AI Agent Active
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {saved && <Check className="h-3.5 w-3.5 text-green-500" />}
          </Label>
          <p
            className="text-muted-foreground text-xs"
            id="ai_enabled-description"
          >
            When disabled, the AI won&apos;t respond to WhatsApp messages
          </p>
        </div>
      </div>
    );
  }

  if (section === "brand") {
    const greetingLength = (data.greeting_template as string)?.length || 0;
    const greetingCharsLeft = GREETING_MAX_LENGTH - greetingLength;

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Brand Tone - comp-02 pattern */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="brand_tone">Brand Tone</Label>
          <Select
            value={data.brand_tone as string}
            onValueChange={(value) => handleChange("brand_tone", value)}
          >
            <SelectTrigger id="brand_tone">
              <SelectValue placeholder="Select a tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly - Warm and approachable</SelectItem>
              <SelectItem value="professional">Professional - Formal and business-like</SelectItem>
              <SelectItem value="casual">Casual - Relaxed and informal</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This affects how the AI agent writes responses
          </p>
        </div>

        {/* Greeting Template - comp-74 pattern with character counter */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="greeting_template">Custom Greeting Template</Label>
          <Textarea
            id="greeting_template"
            aria-describedby="greeting_template-counter"
            placeholder="Hi {{name}}! Welcome to our store. How can I help you today?"
            value={data.greeting_template as string}
            onChange={(e) => {
              if (e.target.value.length <= GREETING_MAX_LENGTH) {
                handleChange("greeting_template", e.target.value);
              }
            }}
            maxLength={GREETING_MAX_LENGTH}
            rows={3}
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Use {"{{name}}"} to include the customer&apos;s name
            </p>
            <p
              aria-live="polite"
              className="text-right text-muted-foreground text-xs tabular-nums"
              id="greeting_template-counter"
              role="status"
            >
              {greetingCharsLeft} left
            </p>
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>
    );
  }

  if (section === "handoff") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Handoff Email */}
          <div className="*:not-first:mt-2">
            <Label htmlFor="handoff_email">Handoff Email</Label>
            <Input
              id="handoff_email"
              type="email"
              placeholder="support@yourstore.com"
              value={data.handoff_email as string}
              onChange={(e) => handleChange("handoff_email", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Receives notification when escalated
            </p>
          </div>

          {/* Handoff Phone */}
          <div className="*:not-first:mt-2">
            <Label htmlFor="handoff_phone">Handoff Phone</Label>
            <Input
              id="handoff_phone"
              type="tel"
              placeholder="+1234567890"
              value={data.handoff_phone as string}
              onChange={(e) => handleChange("handoff_phone", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown when customers request help
            </p>
          </div>
        </div>

        {/* Auto-Handoff Threshold */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="auto_handoff_threshold">Auto-Handoff Threshold</Label>
          <Select
            value={String(data.auto_handoff_threshold)}
            onValueChange={(value) => handleChange("auto_handoff_threshold", parseInt(value))}
          >
            <SelectTrigger id="auto_handoff_threshold">
              <SelectValue placeholder="Select threshold" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">After 2 clarifying questions</SelectItem>
              <SelectItem value="3">After 3 clarifying questions</SelectItem>
              <SelectItem value="4">After 4 clarifying questions</SelectItem>
              <SelectItem value="5">After 5 clarifying questions</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Auto-escalate if AI asks too many clarifying questions
          </p>
        </div>

        {/* Escalation Keywords */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="escalation_keywords">Escalation Keywords</Label>
          <Textarea
            id="escalation_keywords"
            placeholder="lawyer, refund, cancel, complaint, manager"
            value={data.escalation_keywords as string}
            onChange={(e) => handleChange("escalation_keywords", e.target.value)}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated keywords that trigger immediate handoff
          </p>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>
    );
  }

  if (section === "hours") {
    const afterHoursLength = (data.after_hours_message as string)?.length || 0;
    const afterHoursCharsLeft = AFTER_HOURS_MAX_LENGTH - afterHoursLength;

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Timezone */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={data.timezone as string}
            onValueChange={(value) => handleChange("timezone", value)}
          >
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
              <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
              <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
              <SelectItem value="America/Phoenix">Arizona (no DST)</SelectItem>
              <SelectItem value="America/Anchorage">Alaska Time</SelectItem>
              <SelectItem value="Pacific/Honolulu">Hawaii Time</SelectItem>
              <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
              <SelectItem value="Europe/Paris">Central European Time</SelectItem>
              <SelectItem value="Asia/Tokyo">Japan Time</SelectItem>
              <SelectItem value="Asia/Shanghai">China Time</SelectItem>
              <SelectItem value="Australia/Sydney">Sydney Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Working Hours */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="working_hours">Working Hours (JSON)</Label>
          <Textarea
            id="working_hours"
            placeholder='{"mon":"9:00-18:00","tue":"9:00-18:00","wed":"9:00-18:00","thu":"9:00-18:00","fri":"9:00-17:00"}'
            value={data.working_hours as string}
            onChange={(e) => handleChange("working_hours", e.target.value)}
            rows={3}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            JSON format: {`{"mon":"9:00-18:00", ...}`}. Missing days = closed.
          </p>
        </div>

        {/* After Hours Message - with character counter */}
        <div className="*:not-first:mt-2">
          <Label htmlFor="after_hours_message">After Hours Message</Label>
          <Textarea
            id="after_hours_message"
            aria-describedby="after_hours_message-counter"
            placeholder="Thanks for reaching out! We're currently closed but will respond during business hours. Feel free to browse our catalog!"
            value={data.after_hours_message as string}
            onChange={(e) => {
              if (e.target.value.length <= AFTER_HOURS_MAX_LENGTH) {
                handleChange("after_hours_message", e.target.value);
              }
            }}
            maxLength={AFTER_HOURS_MAX_LENGTH}
            rows={3}
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Leave empty to respond 24/7
            </p>
            <p
              aria-live="polite"
              className="text-right text-muted-foreground text-xs tabular-nums"
              id="after_hours_message-counter"
              role="status"
            >
              {afterHoursCharsLeft} left
            </p>
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>
    );
  }

  return null;
}
