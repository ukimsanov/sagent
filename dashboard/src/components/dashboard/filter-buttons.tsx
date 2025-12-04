"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterButtonsProps {
  paramName: string;
  options: FilterOption[];
  label?: string;
}

export function FilterButtons({
  paramName,
  options,
  label = "Filter",
}: FilterButtonsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentValue = searchParams.get(paramName);

  const updateURL = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams, paramName]
  );

  const handleSelect = (value: string) => {
    updateURL(value === currentValue ? null : value);
  };

  const handleClear = () => {
    updateURL(null);
  };

  const selectedOption = options.find((o) => o.value === currentValue);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Filter className="h-4 w-4" />
            )}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={currentValue === option.value ? "bg-accent" : ""}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedOption && (
        <Badge
          variant="secondary"
          className="gap-1 cursor-pointer hover:bg-secondary/80"
          onClick={handleClear}
        >
          {selectedOption.label}
          <X className="h-3 w-3" />
        </Badge>
      )}
    </div>
  );
}
