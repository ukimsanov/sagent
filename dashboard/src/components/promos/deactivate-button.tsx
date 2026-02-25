"use client";

import { Button } from "@/components/ui/button";
import { XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeactivateButtonProps {
  promoId: string;
}

export function DeactivateButton({ promoId }: DeactivateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDeactivate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/promos/${promoId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDeactivate}
      disabled={loading}
      className="h-7 text-xs text-red-600 hover:text-red-700 shrink-0"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <XCircle className="h-3 w-3 mr-1" />
      )}
      Deactivate
    </Button>
  );
}
