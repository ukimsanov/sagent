import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Component() {
  const id = useId();
  return (
    <div className="*:not-first:mt-2">
      <Label htmlFor={id}>Input with error</Label>
      <Input
        aria-invalid
        className="peer"
        defaultValue="invalid@email.com"
        id={id}
        placeholder="Email"
        type="email"
      />
      <p
        aria-live="polite"
        className="mt-2 text-xs peer-aria-invalid:text-destructive"
        role="alert"
      >
        Email is invalid
      </p>
    </div>
  );
}
