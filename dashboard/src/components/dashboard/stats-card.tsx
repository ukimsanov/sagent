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
  Activity,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

// Map icon names to components (since we can't pass components from server to client)
const iconMap: Record<string, LucideIcon> = {
  "message-square": MessageSquare,
  users: Users,
  clock: Clock,
  "alert-circle": AlertCircle,
  "trending-up": TrendingUp,
  activity: Activity,
  "bar-chart": BarChart3,
};

interface StatsCardProps {
  title: string;
  value: number;
  suffix?: string;
  description: string;
  iconName: string;
  delay?: number;
  decimalPlaces?: number;
}

export function StatsCard({
  title,
  value,
  suffix = "",
  description,
  iconName,
  delay = 0,
  decimalPlaces = 0,
}: StatsCardProps) {
  const Icon = iconMap[iconName] || Activity;

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
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </BlurFade>
  );
}
