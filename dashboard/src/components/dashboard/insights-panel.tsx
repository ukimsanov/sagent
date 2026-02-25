"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Lightbulb,
  TrendingUp,
  Search,
  Clock,
  AlertTriangle,
  Flame,
} from "lucide-react";

export interface Insight {
  type: "info" | "warning" | "action";
  icon: "search" | "trending" | "clock" | "alert" | "flame";
  message: string;
}

interface InsightsPanelProps {
  insights: Insight[];
}

const iconMap = {
  search: Search,
  trending: TrendingUp,
  clock: Clock,
  alert: AlertTriangle,
  flame: Flame,
};

const typeColors = {
  info: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  warning: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  action: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const Icon = iconMap[insight.icon] || Lightbulb;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg p-3 ${typeColors[insight.type]}`}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-sm">{insight.message}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
