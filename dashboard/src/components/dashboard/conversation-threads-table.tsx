"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlurFade } from "@/components/ui/blur-fade";
import { MessageSquare, AlertTriangle } from "lucide-react";

interface ConversationThread {
  lead_id: string;
  lead_name: string | null;
  whatsapp_number: string;
  lead_score: number;
  lead_status: string;
  message_count: number;
  last_activity: number;
  last_message: string | null;
  flag_count: number;
}

interface ConversationThreadsTableProps {
  threads: ConversationThread[];
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    new: "",
    engaged: "bg-chart-5/10 text-chart-5",
    warm: "bg-chart-3/10 text-chart-3",
    hot: "bg-chart-4/10 text-chart-4",
    converted: "bg-chart-2/10 text-chart-2",
    lost: "bg-muted text-muted-foreground",
  };
  return map[status] || "";
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-chart-4 font-bold";
  if (score >= 50) return "text-chart-3 font-semibold";
  if (score >= 20) return "text-chart-5";
  return "text-muted-foreground";
}

export function ConversationThreadsTable({ threads }: ConversationThreadsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Last Message</TableHead>
          <TableHead className="text-center">Messages</TableHead>
          <TableHead className="text-center">Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead className="text-center">Flags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {threads.length > 0 ? (
          threads.map((thread, index) => (
            <BlurFade
              key={thread.lead_id}
              delay={0.02 * index}
              direction="up"
              className="contents"
            >
              <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
                <TableCell>
                  <Link href={`/conversations/${thread.lead_id}`} className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {thread.lead_name
                          ? thread.lead_name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                          : thread.whatsapp_number.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {thread.lead_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        +{thread.whatsapp_number}
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="max-w-[250px]">
                  <Link href={`/conversations/${thread.lead_id}`} className="block">
                    <p className="text-sm text-muted-foreground truncate">
                      {thread.last_message || "—"}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  <Link href={`/conversations/${thread.lead_id}`} className="flex items-center justify-center gap-1">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{thread.message_count}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  <Link href={`/conversations/${thread.lead_id}`} className="block">
                    <span className={`text-sm ${getScoreColor(thread.lead_score)}`}>
                      {thread.lead_score}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/conversations/${thread.lead_id}`} className="block">
                    <Badge variant="secondary" className={getStatusColor(thread.lead_status)}>
                      {thread.lead_status}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <Link href={`/conversations/${thread.lead_id}`} className="block">
                    {thread.last_activity ? formatTimeAgo(thread.last_activity) : "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  <Link href={`/conversations/${thread.lead_id}`} className="block">
                    {thread.flag_count > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {thread.flag_count}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </Link>
                </TableCell>
              </TableRow>
            </BlurFade>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No conversations yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
