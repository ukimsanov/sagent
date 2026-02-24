"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Loader2, Store, MessageSquare, Sparkles } from "lucide-react";

interface OnboardingWizardProps {
  userName: string;
}

const GREETING_MAX_LENGTH = 300;

export function OnboardingWizard({ userName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 data
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");

  // Step 2 data
  const [brandTone, setBrandTone] = useState("friendly");
  const [greetingTemplate, setGreetingTemplate] = useState("");

  const canProceedStep1 = businessName.trim().length > 0;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName.trim(),
          timezone,
          brand_tone: brandTone,
          greeting_template: greetingTemplate || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to create business");
      }

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s < step
                  ? "bg-primary text-primary-foreground"
                  : s === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-12 transition-colors ${
                  s < step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Business Info */}
      {step === 1 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Hey {userName}!</CardTitle>
            <CardDescription className="text-base">
              Let&apos;s set up your AI sales agent. First, tell us about your business.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name</Label>
              <Input
                id="business-name"
                placeholder="e.g., Acme Streetwear"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
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
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Brand Voice */}
      {step === 2 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-chart-5/10 flex items-center justify-center mb-2">
              <MessageSquare className="h-6 w-6 text-chart-5" />
            </div>
            <CardTitle className="text-2xl">Brand Voice</CardTitle>
            <CardDescription className="text-base">
              How should your AI agent talk to customers?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-tone">Tone</Label>
              <Select value={brandTone} onValueChange={setBrandTone}>
                <SelectTrigger id="brand-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly — Warm and approachable</SelectItem>
                  <SelectItem value="professional">Professional — Formal and polished</SelectItem>
                  <SelectItem value="casual">Casual — Relaxed and informal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="greeting">Custom Greeting (optional)</Label>
              <Textarea
                id="greeting"
                placeholder={`Hi {{name}}! Welcome to ${businessName || "our store"}. How can I help you today?`}
                value={greetingTemplate}
                onChange={(e) => {
                  if (e.target.value.length <= GREETING_MAX_LENGTH) {
                    setGreetingTemplate(e.target.value);
                  }
                }}
                maxLength={GREETING_MAX_LENGTH}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Use {"{{name}}"} for customer&apos;s name
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {GREETING_MAX_LENGTH - greetingTemplate.length} left
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Business
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now — use defaults
            </button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-2">
              <Sparkles className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
            <CardDescription className="text-base">
              <strong>{businessName}</strong> is ready to go. Your AI agent is live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => router.push("/")}>
              Go to Dashboard
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => router.push("/products/new")}>
                Add Products
              </Button>
              <Button variant="outline" onClick={() => router.push("/settings")}>
                More Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
