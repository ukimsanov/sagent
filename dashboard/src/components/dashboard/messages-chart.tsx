"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  date: string;
  messages: number;
  unique_leads: number;
  handoffs: number;
}

interface MessagesChartProps {
  data: DataPoint[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MessagesChart({ data }: MessagesChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Messages Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={formatted} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Area
                type="monotone"
                dataKey="messages"
                name="Messages"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#msgGradient)"
              />
              <Area
                type="monotone"
                dataKey="unique_leads"
                name="Unique Leads"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#leadsGradient)"
              />
              <Area
                type="monotone"
                dataKey="handoffs"
                name="Handoffs"
                stroke="hsl(var(--chart-4))"
                strokeWidth={1.5}
                fill="none"
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
