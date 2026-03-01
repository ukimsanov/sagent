"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

export function SyncSearchButton() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSync = async () => {
    setSyncing(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/products/embed", { method: "POST" });
      if (!response.ok) throw new Error("Sync failed");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleSync}
            disabled={syncing}
            className="h-9 w-9"
          >
            {status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : status === "error" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {syncing
              ? "Syncing search index..."
              : status === "success"
                ? "Search index synced!"
                : status === "error"
                  ? "Sync failed — try again"
                  : "Sync AI search index"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
