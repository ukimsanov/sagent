"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { ChevronRight } from "lucide-react";
import { getActionColor } from "@/lib/utils";

interface ActivityItemProps {
  phone: string;
  action: string;
  timeAgo: string;
  leadId: string;
  delay?: number;
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
