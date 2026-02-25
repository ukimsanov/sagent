"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ResolveButtonProps {
  escalationId: string;
}

export function ResolveButton({ escalationId }: ResolveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleResolve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/escalations/${escalationId}`, {
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
      variant="outline"
      size="sm"
      onClick={handleResolve}
      disabled={loading}
      className="shrink-0"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <CheckCircle2 className="h-3 w-3 mr-1" />
      )}
      Resolve
    </Button>
  );
}
