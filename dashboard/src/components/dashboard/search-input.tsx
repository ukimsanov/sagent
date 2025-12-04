"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2 } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

interface SearchInputProps {
  placeholder?: string;
  paramName?: string;
}

export function SearchInput({
  placeholder = "Search...",
  paramName = "q",
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentValue = searchParams.get(paramName) || "";
  const [inputValue, setInputValue] = useState(currentValue);

  const updateURL = useCallback(
    (value: string) => {
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

  const debouncedUpdateURL = useDebouncedCallback(updateURL, 300);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    debouncedUpdateURL(value);
  };

  const handleClear = () => {
    setInputValue("");
    updateURL("");
  };

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        className="pl-9 pr-9 h-9"
      />
      {isPending ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      ) : inputValue ? (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
