"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SentimentData {
  sentiment: string;
  count: number;
}

interface SentimentChartProps {
  data: SentimentData[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "hsl(var(--chart-2))",
  neutral: "hsl(var(--chart-5))",
  negative: "hsl(var(--chart-4))",
  frustrated: "hsl(var(--destructive))",
};

function formatLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SentimentChart({ data }: SentimentChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const formatted = data.map((d) => ({
    name: formatLabel(d.sentiment),
    value: d.count,
    color: SENTIMENT_COLORS[d.sentiment] || "hsl(var(--muted))",
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Customer Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No sentiment data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={formatted}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {formatted.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value) => [
                  `${value} (${Math.round((Number(value) / total) * 100)}%)`,
                  "Count",
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
