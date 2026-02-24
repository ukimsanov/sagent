"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SearchData {
  search_query: string;
  count: number;
}

interface SearchBarChartProps {
  data: SearchData[];
}

export function SearchBarChart({ data }: SearchBarChartProps) {
  const formatted = data.slice(0, 8).map((d) => ({
    query: d.search_query.length > 18
      ? d.search_query.slice(0, 16) + "..."
      : d.search_query,
    count: d.count,
    fullQuery: d.search_query,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Top Product Searches</CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No search data yet
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
                dataKey="query"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value) => [String(value ?? 0), "Searches"]}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as { fullQuery?: string } | undefined;
                  return item?.fullQuery || "";
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--chart-3))"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
