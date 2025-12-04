"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlurFade } from "@/components/ui/blur-fade";

interface MessageEvent {
  id: string;
  lead_id: string;
  user_message: string | null;
  action: string;
  intent_type: string | null;
  timestamp: number;
  flagged_for_human: number; // SQLite uses 0/1 for booleans
}

interface ConversationsTableProps {
  events: MessageEvent[];
}

function getActionBadge(action: string) {
  const colors: Record<string, string> = {
    show_products: "bg-primary/10 text-primary",
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

function maskPhone(leadId: string) {
  const last4 = leadId.slice(-4);
  return `+1 xxx-xxx-${last4}`;
}

export function ConversationsTable({ events }: ConversationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Last Message</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Intent</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length > 0 ? (
          events.map((event, index) => (
            <BlurFade
              key={event.id}
              delay={0.02 * index}
              direction="up"
              className="contents"
            >
              <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
                <TableCell className="font-mono text-sm">
                  <Link href={`/conversations/${event.lead_id}`} className="block">
                    {maskPhone(event.lead_id)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  <Link href={`/conversations/${event.lead_id}`} className="block">
                    {event.user_message || "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/conversations/${event.lead_id}`} className="block">
                    <Badge variant="secondary" className={getActionBadge(event.action)}>
                      {event.action.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <Link href={`/conversations/${event.lead_id}`} className="block">
                    {event.intent_type?.replace(/_/g, " ") || "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <Link href={`/conversations/${event.lead_id}`} className="block">
                    {formatTimeAgo(event.timestamp)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/conversations/${event.lead_id}`} className="block">
                    {event.flagged_for_human ? (
                      <Badge variant="destructive">Flagged</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </Link>
                </TableCell>
              </TableRow>
            </BlurFade>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No conversations yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
