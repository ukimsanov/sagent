"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreatePromoForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [expiresIn, setExpiresIn] = useState("30");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const expiresAt = expiresIn
        ? Math.floor(Date.now() / 1000) + parseInt(expiresIn) * 24 * 60 * 60
        : null;

      const res = await fetch("/api/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discount_percent: discountPercent ? parseInt(discountPercent) : null,
          discount_amount: discountAmount ? parseFloat(discountAmount) : null,
          expires_at: expiresAt,
        }),
      });

      if (res.ok) {
        setOpen(false);
        setCode("");
        setDiscountPercent("");
        setDiscountAmount("");
        setExpiresIn("30");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create Code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Promo Code</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SAVE10"
              className="uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="discount_percent">Discount %</Label>
              <Input
                id="discount_percent"
                type="number"
                min="1"
                max="100"
                value={discountPercent}
                onChange={(e) => {
                  setDiscountPercent(e.target.value);
                  if (e.target.value) setDiscountAmount("");
                }}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <Label htmlFor="discount_amount">Or fixed $</Label>
              <Input
                id="discount_amount"
                type="number"
                min="0.01"
                step="0.01"
                value={discountAmount}
                onChange={(e) => {
                  setDiscountAmount(e.target.value);
                  if (e.target.value) setDiscountPercent("");
                }}
                placeholder="e.g. 5.00"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="expires_in">Expires in (days)</Label>
            <Input
              id="expires_in"
              type="number"
              min="1"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              placeholder="30"
            />
          </div>
          <Button type="submit" disabled={loading || !code.trim()} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Promo Code
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
