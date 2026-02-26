"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReplyBoxProps {
  leadId: string;
}

export function ReplyBox({ leadId }: ReplyBoxProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/conversations/${leadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (res.ok) {
        setStatus("success");
        setMessage("");
        router.refresh();
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        const data = (await res.json()) as { error?: string };
        setStatus("error");
        setErrorMsg(data.error || "Failed to send");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t pt-4 space-y-2">
      <Textarea
        placeholder="Type a reply to send via WhatsApp..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={4096}
        disabled={loading}
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {message.length}/4096
          {status === "success" && (
            <span className="ml-2 text-emerald-600 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Sent
            </span>
          )}
          {status === "error" && (
            <span className="ml-2 text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errorMsg}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={loading || !message.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Send Reply
        </Button>
      </div>
    </div>
  );
}
