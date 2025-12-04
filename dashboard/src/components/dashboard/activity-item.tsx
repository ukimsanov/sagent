"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { ChevronRight } from "lucide-react";

interface ActivityItemProps {
  phone: string;
  action: string;
  timeAgo: string;
  leadId: string;
  delay?: number;
}

function getActionColor(action: string) {
  const colors: Record<string, string> = {
    show_products: "bg-chart-1/10 text-chart-1",
    ask_clarification: "bg-chart-3/10 text-chart-3",
    answer_question: "bg-chart-2/10 text-chart-2",
    empathize: "bg-chart-4/10 text-chart-4",
    greet: "bg-chart-5/10 text-chart-5",
    thank: "bg-chart-2/10 text-chart-2",
    handoff: "bg-destructive/10 text-destructive",
    farewell: "bg-muted text-muted-foreground",
  };
  return colors[action] || "bg-muted text-muted-foreground";
}

export function ActivityItem({ phone, action, timeAgo, leadId, delay = 0 }: ActivityItemProps) {
  return (
    <BlurFade delay={delay} direction="left">
      <Link
        href={`/conversations/${leadId}`}
        className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/50 transition-colors rounded-md px-3 -mx-3 group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono">{phone}</span>
          <Badge variant="secondary" className={getActionColor(action)}>
            {action.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </BlurFade>
  );
}
