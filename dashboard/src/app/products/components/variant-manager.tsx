"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface VariantRow {
  size: string;
  color: string;
  sku: string;
  stock_quantity: number;
  price_override: string; // kept as string for form input
}

interface VariantManagerProps {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
  disabled?: boolean;
}

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export function VariantManager({
  variants,
  onChange,
  disabled,
}: VariantManagerProps) {
  const [quickSizesOpen, setQuickSizesOpen] = useState(false);

  const addVariant = useCallback(() => {
    onChange([
      ...variants,
      { size: "", color: "", sku: "", stock_quantity: 0, price_override: "" },
    ]);
  }, [variants, onChange]);

  const removeVariant = useCallback(
    (index: number) => {
      onChange(variants.filter((_, i) => i !== index));
    },
    [variants, onChange]
  );

  const updateVariant = useCallback(
    (index: number, field: keyof VariantRow, value: string | number) => {
      const updated = variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      );
      onChange(updated);
    },
    [variants, onChange]
  );

  const addQuickSizes = useCallback(
    (sizes: string[]) => {
      // Find existing sizes to avoid duplicates
      const existingSizes = new Set(variants.map((v) => v.size));
      const newVariants = sizes
        .filter((s) => !existingSizes.has(s))
        .map((size) => ({
          size,
          color: "",
          sku: "",
          stock_quantity: 0,
          price_override: "",
        }));
      onChange([...variants, ...newVariants]);
      setQuickSizesOpen(false);
    },
    [variants, onChange]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Sizes & Variants</Label>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track stock per size and color combination
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickSizesOpen(!quickSizesOpen)}
            disabled={disabled}
          >
            Quick Add Sizes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVariant}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Variant
          </Button>
        </div>
      </div>

      {/* Quick Size Picker */}
      {quickSizesOpen && (
        <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
          <span className="text-sm text-muted-foreground mr-1">Add:</span>
          {COMMON_SIZES.map((size) => {
            const exists = variants.some((v) => v.size === size);
            return (
              <Badge
                key={size}
                variant={exists ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  exists
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-primary hover:text-primary-foreground"
                }`}
                onClick={() => {
                  if (!exists && !disabled) addQuickSizes([size]);
                }}
              >
                {size}
              </Badge>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0"
            onClick={() =>
              addQuickSizes(
                COMMON_SIZES.filter(
                  (s) => !variants.some((v) => v.size === s)
                )
              )
            }
            disabled={disabled}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setQuickSizesOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Variant Rows */}
      {variants.length > 0 && (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_80px_100px_32px] gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              Size
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Color
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              SKU
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Stock
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Price
            </span>
            <span />
          </div>

          {/* Rows */}
          {variants.map((variant, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_1fr_80px_100px_32px] gap-2 items-center"
            >
              <Input
                placeholder="M"
                value={variant.size}
                onChange={(e) =>
                  updateVariant(index, "size", e.target.value)
                }
                disabled={disabled}
                className="h-9"
              />
              <Input
                placeholder="Black"
                value={variant.color}
                onChange={(e) =>
                  updateVariant(index, "color", e.target.value)
                }
                disabled={disabled}
                className="h-9"
              />
              <Input
                placeholder="SKU-001"
                value={variant.sku}
                onChange={(e) =>
                  updateVariant(index, "sku", e.target.value)
                }
                disabled={disabled}
                className="h-9"
              />
              <Input
                type="number"
                min="0"
                value={variant.stock_quantity}
                onChange={(e) =>
                  updateVariant(
                    index,
                    "stock_quantity",
                    parseInt(e.target.value) || 0
                  )
                }
                disabled={disabled}
                className="h-9 text-center"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Override"
                value={variant.price_override}
                onChange={(e) =>
                  updateVariant(index, "price_override", e.target.value)
                }
                disabled={disabled}
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => removeVariant(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Summary */}
          <div className="flex items-center gap-4 pt-2 px-1 text-xs text-muted-foreground">
            <span>
              {variants.length} variant{variants.length !== 1 ? "s" : ""}
            </span>
            <span>
              Total stock:{" "}
              {variants.reduce((sum, v) => sum + v.stock_quantity, 0)} units
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {variants.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground border rounded-md border-dashed">
          No variants yet. Add sizes to track per-size inventory.
        </div>
      )}
    </div>
  );
}
