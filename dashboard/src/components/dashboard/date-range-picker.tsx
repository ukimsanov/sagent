"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_OPTIONS, parseRange } from "@/lib/date-range";

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = parseRange(searchParams.get("range"));

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={currentRange} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
