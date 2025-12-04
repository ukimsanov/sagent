/**
 * Landing Page Component
 *
 * Shown to unauthenticated users on the home page.
 * Provides information about the product and login/signup buttons.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { MessageSquare, Users, Zap, BarChart3 } from "lucide-react";

export function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-2xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#25D366] ring-1 ring-emerald-100 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/60">
            <WhatsappIcon className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold">WhatsApp AI Agent</h1>
        </div>

        <p className="text-xl text-muted-foreground">
          Automate your customer conversations with an intelligent AI sales agent.
          Turn WhatsApp into your 24/7 sales channel.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button asChild size="lg" className="gap-2">
            <Link href="/auth/login">
              Sign In
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">
              Get Started
            </Link>
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 max-w-5xl">
        <FeatureCard
          icon={MessageSquare}
          title="Smart Conversations"
          description="AI-powered responses that understand context and provide helpful answers."
        />
        <FeatureCard
          icon={Users}
          title="Lead Management"
          description="Automatically score and track leads through your sales funnel."
        />
        <FeatureCard
          icon={Zap}
          title="Instant Responses"
          description="24/7 availability with sub-second response times."
        />
        <FeatureCard
          icon={BarChart3}
          title="Analytics Dashboard"
          description="Track performance, conversion rates, and customer insights."
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
