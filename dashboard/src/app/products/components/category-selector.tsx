"use client";

import { useState, useId } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CategorySelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  categories: string[];
  disabled?: boolean;
}

export function CategorySelector({
  value,
  onChange,
  categories,
  disabled = false,
}: CategorySelectorProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Check if the search term is a new category (not in existing categories)
  const isNewCategory =
    search.trim() !== "" &&
    !categories.some((cat) => cat.toLowerCase() === search.trim().toLowerCase());

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onChange(null); // Deselect if clicking same
    } else {
      onChange(selectedValue);
    }
    setOpen(false);
    setSearch("");
  };

  const handleCreateNew = () => {
    const newCategory = search.trim();
    if (newCategory) {
      onChange(newCategory);
      setOpen(false);
      setSearch("");
    }
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          role="combobox"
          aria-expanded={open}
          variant="outline"
          disabled={disabled}
          className="w-full justify-between border-input bg-background px-3 font-normal outline-none outline-offset-0 hover:bg-background focus-visible:outline-[3px]"
        >
          <span className={cn("truncate flex items-center gap-2", !value && "text-muted-foreground")}>
            {value ? (
              <>
                <TagIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                {value}
              </>
            ) : (
              "Select category"
            )}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="shrink-0 text-muted-foreground/80"
            size={16}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-full min-w-[var(--radix-popper-anchor-width)] border-input p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create category..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search.trim() === "" ? (
                "No categories yet"
              ) : (
                <span className="text-muted-foreground">
                  No matching categories
                </span>
              )}
            </CommandEmpty>

            {/* Existing categories */}
            {categories.length > 0 && (
              <CommandGroup heading="Categories">
                {categories
                  .filter((cat) =>
                    search.trim() === ""
                      ? true
                      : cat.toLowerCase().includes(search.trim().toLowerCase())
                  )
                  .map((category) => (
                    <CommandItem
                      key={category}
                      value={category}
                      onSelect={() => handleSelect(category)}
                    >
                      <TagIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
                      {category}
                      {value === category && (
                        <CheckIcon className="ml-auto" size={16} />
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {/* Create new option */}
            {isNewCategory && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`create-${search.trim()}`}
                    onSelect={handleCreateNew}
                    className="cursor-pointer"
                  >
                    <PlusIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
                    Create &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {/* Clear selection */}
            {value && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="clear-selection"
                    onSelect={handleClear}
                    className="text-muted-foreground cursor-pointer"
                  >
                    Clear selection
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
