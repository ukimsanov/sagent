"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AppointmentActionsProps {
  appointmentId: string;
}

export function AppointmentActions({ appointmentId }: AppointmentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(status: "confirmed" | "cancelled") {
    setLoading(status);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
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

  return (
    <div className="flex gap-1 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction("confirmed")}
        disabled={loading !== null}
        className="h-7 text-xs"
      >
        {loading === "confirmed" ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <CheckCircle2 className="h-3 w-3 mr-1" />
        )}
        Confirm
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleAction("cancelled")}
        disabled={loading !== null}
        className="h-7 text-xs text-red-600 hover:text-red-700"
      >
        {loading === "cancelled" ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <XCircle className="h-3 w-3 mr-1" />
        )}
        Cancel
      </Button>
    </div>
  );
}
