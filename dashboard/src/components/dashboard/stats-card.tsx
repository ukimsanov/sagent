"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import {
  MessageSquare,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "message-square": MessageSquare,
  users: Users,
  clock: Clock,
  "alert-circle": AlertCircle,
  "trending-up": TrendingUp,
  activity: Activity,
  "bar-chart": BarChart3,
  "shield-check": ShieldCheck,
};

interface StatsCardProps {
  title: string;
  value: number;
  suffix?: string;
  description: string;
  iconName: string;
  delay?: number;
  decimalPlaces?: number;
  /** Percentage change vs previous period. Positive = increase. */
  change?: number;
  /** If true, a positive change is bad (e.g. handoff rate going up). */
  invertColor?: boolean;
}

export function StatsCard({
  title,
  value,
  suffix = "",
  description,
  iconName,
  delay = 0,
  decimalPlaces = 0,
  change,
  invertColor = false,
}: StatsCardProps) {
  const Icon = iconMap[iconName] || Activity;

  const showChange = change !== undefined && change !== 0;
  const isPositiveChange = change !== undefined && change > 0;
  const isGood = invertColor ? !isPositiveChange : isPositiveChange;

  return (
    <BlurFade delay={delay}>
      <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <NumberTicker value={value} decimalPlaces={decimalPlaces} />
            {suffix}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {showChange && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  isGood
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isPositiveChange ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(change!)}%
              </span>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  );
}
