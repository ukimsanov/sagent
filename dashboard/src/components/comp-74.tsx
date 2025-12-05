"use client";

import { useId } from "react";

import { useCharacterLimit } from "@/hooks/use-character-limit";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Component() {
  const id = useId();
  const maxLength = 180;
  const {
    value,
    characterCount,
    handleChange,
    maxLength: limit,
  } = useCharacterLimit({ maxLength });

  return (
    <div className="*:not-first:mt-2">
      <Label htmlFor={id}>Textarea with characters left</Label>
      <Textarea
        aria-describedby={`${id}-description`}
        id={id}
        maxLength={maxLength}
        onChange={handleChange}
        value={value}
      />
      <p
        aria-live="polite"
        className="mt-2 text-right text-muted-foreground text-xs"
        id={`${id}-description`}
        role="status"
      >
        <span className="tabular-nums">{limit - characterCount}</span>{" "}
        characters left
      </p>
    </div>
  );
}
