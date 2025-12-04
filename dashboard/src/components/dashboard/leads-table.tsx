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

interface Lead {
  id: string;
  name: string | null;
  whatsapp_number: string;
  score: number;
  status: string;
  message_count: number;
  last_contact: number;
}

interface LeadsTableProps {
  leads: Lead[];
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    new: { variant: "outline", className: "" },
    engaged: { variant: "secondary", className: "bg-chart-5/10 text-chart-5" },
    warm: { variant: "secondary", className: "bg-chart-3/10 text-chart-3" },
    hot: { variant: "secondary", className: "bg-chart-4/10 text-chart-4" },
    converted: { variant: "secondary", className: "bg-chart-2/10 text-chart-2" },
    lost: { variant: "secondary", className: "bg-muted text-muted-foreground" },
  };
  const style = variants[status] || variants.new;
  return <Badge variant={style.variant} className={style.className}>{status}</Badge>;
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-chart-4";
  if (score >= 50) return "text-chart-3";
  if (score >= 20) return "text-chart-5";
  return "text-muted-foreground";
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() / 1000 - timestamp));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return phone.slice(-2);
}

export function LeadsTable({ leads }: LeadsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Messages</TableHead>
          <TableHead>Last Contact</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.length > 0 ? (
          leads.map((lead, index) => (
            <BlurFade
              key={lead.id}
              delay={0.02 * index}
              direction="up"
              className="contents"
            >
              <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
                <TableCell>
                  <Link href={`/conversations/${lead.id}`} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 transition-transform hover:scale-105">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(lead.name, lead.whatsapp_number)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {lead.name || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        +{lead.whatsapp_number}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/conversations/${lead.id}`} className="block">
                    <div className={`font-bold ${getScoreColor(lead.score)}`}>
                      {lead.score}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/conversations/${lead.id}`} className="block">
                    {getStatusBadge(lead.status)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Link href={`/conversations/${lead.id}`} className="block">
                    {lead.message_count}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <Link href={`/conversations/${lead.id}`} className="block">
                    {formatTimeAgo(lead.last_contact)}
                  </Link>
                </TableCell>
              </TableRow>
            </BlurFade>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No leads yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
