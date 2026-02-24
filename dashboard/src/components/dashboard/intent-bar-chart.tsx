"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IntentData {
  intent_type: string;
  count: number;
}

interface IntentBarChartProps {
  data: IntentData[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

function formatLabel(intent: string): string {
  return intent
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IntentBarChart({ data }: IntentBarChartProps) {
  const formatted = data.slice(0, 8).map((d) => ({
    ...d,
    label: formatLabel(d.intent_type),
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Customer Intents</CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No intent data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={formatted}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value) => [String(value ?? 0), "Count"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {formatted.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
