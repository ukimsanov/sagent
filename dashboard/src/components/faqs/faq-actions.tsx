"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface FaqActionsProps {
  faqId: string;
  currentStatus: string;
}

export function FaqActions({ faqId, currentStatus }: FaqActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(status: "approved" | "rejected") {
    setLoading(status);
    try {
      const res = await fetch(`/api/faqs/${faqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  if (currentStatus === "approved") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction("rejected")}
        disabled={loading !== null}
        className="shrink-0 text-red-600 hover:text-red-700"
      >
        {loading === "rejected" ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <XCircle className="h-3 w-3 mr-1" />
        )}
        Reject
      </Button>
    );
  }

  if (currentStatus === "rejected") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction("approved")}
        disabled={loading !== null}
        className="shrink-0 text-green-600 hover:text-green-700"
      >
        {loading === "approved" ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <CheckCircle2 className="h-3 w-3 mr-1" />
        )}
        Approve
      </Button>
    );
  }

  // Draft status — show both buttons
  return (
    <div className="flex gap-1 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction("approved")}
        disabled={loading !== null}
        className="text-green-600 hover:text-green-700"
      >
        {loading === "approved" ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <CheckCircle2 className="h-3 w-3 mr-1" />
        )}
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction("rejected")}
        disabled={loading !== null}
        className="text-red-600 hover:text-red-700"
      >
        {loading === "rejected" ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <XCircle className="h-3 w-3 mr-1" />
        )}
        Reject
      </Button>
    </div>
  );
}
