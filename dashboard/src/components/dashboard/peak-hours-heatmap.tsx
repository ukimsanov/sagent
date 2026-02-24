"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PeakHourPoint {
  hour: number;
  day_of_week: number;
  count: number;
}

interface PeakHoursHeatmapProps {
  data: PeakHourPoint[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityClass(count: number, max: number): string {
  if (count === 0 || max === 0) return "bg-muted/30";
  const ratio = count / max;
  if (ratio > 0.75) return "bg-primary";
  if (ratio > 0.5) return "bg-primary/70";
  if (ratio > 0.25) return "bg-primary/40";
  return "bg-primary/15";
}

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export function PeakHoursHeatmap({ data }: PeakHoursHeatmapProps) {
  // Build a lookup map
  const lookup = new Map<string, number>();
  let maxCount = 0;
  for (const point of data) {
    const key = `${point.day_of_week}-${point.hour}`;
    lookup.set(key, point.count);
    if (point.count > maxCount) maxCount = point.count;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Peak Hours</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No activity data yet
          </div>
        ) : (
          <TooltipProvider delayDuration={100}>
            <div className="space-y-1">
              {/* Hour labels */}
              <div className="flex gap-px ml-9">
                {HOURS.filter((h) => h % 3 === 0).map((h) => (
                  <span
                    key={h}
                    className="text-[10px] text-muted-foreground"
                    style={{ width: `${(3 / 24) * 100}%` }}
                  >
                    {formatHour(h)}
                  </span>
                ))}
              </div>
              {/* Grid rows */}
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
                    {day}
                  </span>
                  <div className="flex gap-px flex-1">
                    {HOURS.map((hour) => {
                      const count = lookup.get(`${dayIndex}-${hour}`) || 0;
                      return (
                        <Tooltip key={hour}>
                          <TooltipTrigger asChild>
                            <div
                              className={`aspect-square flex-1 rounded-[2px] transition-colors ${getIntensityClass(count, maxCount)}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {day} {formatHour(hour)}: {count} messages
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center justify-end gap-1 pt-2">
                <span className="text-[10px] text-muted-foreground mr-1">Less</span>
                <div className="w-3 h-3 rounded-[2px] bg-muted/30" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/15" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/40" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/70" />
                <div className="w-3 h-3 rounded-[2px] bg-primary" />
                <span className="text-[10px] text-muted-foreground ml-1">More</span>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
