"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MinusIcon, PlusIcon } from "lucide-react";
import {
  Button,
  Group,
  Input as AriaInput,
  Label as AriaLabel,
  NumberField,
} from "react-aria-components";
import { Button as ShadButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "./image-upload";
import { CategorySelector } from "./category-selector";
import type { ProductWithImages } from "@/lib/db";

interface ProductFormProps {
  product?: ProductWithImages;
  categories: string[];
  mode: "create" | "edit";
}

interface FormData {
  name: string;
  description: string;
  price: string;
  currency: string;
  category: string | null;
  in_stock: boolean;
  stock_quantity: number | null;
  image_urls: string[];
}

interface FormErrors {
  name?: string;
  price?: string;
  stock_quantity?: string;
  general?: string;
}

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "AUD", label: "AUD ($)" },
  { value: "CHF", label: "CHF (Fr)" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "INR", label: "INR (₹)" },
  { value: "KRW", label: "KRW (₩)" },
];

const DESCRIPTION_MAX_LENGTH = 500;

export function ProductForm({ product, categories, mode }: ProductFormProps) {
  const router = useRouter();
  const formId = useId();

  const [formData, setFormData] = useState<FormData>({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price?.toString() ?? "",
    currency: product?.currency ?? "USD",
    category: product?.category ?? null,
    in_stock: product?.in_stock === 1,
    stock_quantity: product?.stock_quantity ?? null,
    image_urls: product?.image_urls ?? [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Product name is required";
    }

    if (formData.price && isNaN(parseFloat(formData.price))) {
      newErrors.price = "Price must be a valid number";
    }

    if (formData.price && parseFloat(formData.price) < 0) {
      newErrors.price = "Price cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        currency: formData.currency,
        category: formData.category,
        in_stock: formData.in_stock,
        stock_quantity: formData.stock_quantity,
        image_urls: formData.image_urls,
      };

      const url =
        mode === "create" ? "/api/products" : `/api/products/${product?.id}`;

      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to save product");
      }

      router.push("/products");
      router.refresh();
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    field: keyof FormData,
    value: string | boolean | string[] | number | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const descriptionLength = formData.description.length;
  const descriptionCharsLeft = DESCRIPTION_MAX_LENGTH - descriptionLength;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* General error */}
      {errors.general && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm"
          role="alert"
        >
          {errors.general}
        </div>
      )}

      {/* Images Section */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-medium">Product Images</Label>
          <p className="text-muted-foreground text-sm mt-0.5">
            Upload up to 6 images. The first image will be the main product image.
          </p>
        </div>
        <ImageUpload
          value={formData.image_urls}
          onChange={(urls) => handleChange("image_urls", urls)}
          disabled={isSubmitting}
        />
      </div>

      {/* Basic Info Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-base border-b pb-2">Basic Information</h3>

        {/* Name - comp-02 + comp-06 pattern */}
        <div className="*:not-first:mt-2">
          <Label htmlFor={`${formId}-name`}>
            Product Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${formId}-name`}
            className="peer"
            placeholder="e.g., Classic Black Hoodie"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            disabled={isSubmitting}
            aria-invalid={!!errors.name || undefined}
          />
          {errors.name && (
            <p
              aria-live="polite"
              className="mt-2 text-xs peer-aria-invalid:text-destructive text-destructive"
              role="alert"
            >
              {errors.name}
            </p>
          )}
        </div>

        {/* Description - comp-74 pattern with character counter */}
        <div className="*:not-first:mt-2">
          <Label htmlFor={`${formId}-description`}>Description</Label>
          <Textarea
            id={`${formId}-description`}
            aria-describedby={`${formId}-description-counter`}
            placeholder="Describe your product features, materials, and more..."
            value={formData.description}
            onChange={(e) => {
              if (e.target.value.length <= DESCRIPTION_MAX_LENGTH) {
                handleChange("description", e.target.value);
              }
            }}
            disabled={isSubmitting}
            maxLength={DESCRIPTION_MAX_LENGTH}
            className="min-h-[120px]"
          />
          <p
            aria-live="polite"
            className="mt-2 text-right text-muted-foreground text-xs"
            id={`${formId}-description-counter`}
            role="status"
          >
            <span className="tabular-nums">{descriptionCharsLeft}</span> characters left
          </p>
        </div>

        {/* Category */}
        <div className="*:not-first:mt-2">
          <Label htmlFor={`${formId}-category`}>Category</Label>
          <CategorySelector
            value={formData.category}
            onChange={(value) => handleChange("category", value)}
            categories={categories}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Pricing Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-base border-b pb-2">Pricing</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Price */}
          <div className="*:not-first:mt-2">
            <Label htmlFor={`${formId}-price`}>Price</Label>
            <Input
              id={`${formId}-price`}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) => handleChange("price", e.target.value)}
              disabled={isSubmitting}
              aria-invalid={!!errors.price || undefined}
              className="peer"
            />
            {errors.price && (
              <p
                aria-live="polite"
                className="mt-2 text-xs text-destructive"
                role="alert"
              >
                {errors.price}
              </p>
            )}
          </div>

          {/* Currency */}
          <div className="*:not-first:mt-2">
            <Label htmlFor={`${formId}-currency`}>Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => handleChange("currency", value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id={`${formId}-currency`}>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Inventory Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-base border-b pb-2">Inventory</h3>

        {/* In Stock Toggle - comp-186 pattern */}
        <div className="relative flex w-full items-start gap-2 rounded-md border border-input p-4 shadow-xs outline-none has-data-[state=checked]:border-primary/50">
          <Switch
            id={`${formId}-in-stock`}
            aria-describedby={`${formId}-in-stock-description`}
            className="data-[state=checked]:[&_span]:rtl:-translate-x-2 order-1 h-4 w-6 after:absolute after:inset-0 [&_span]:size-3 data-[state=checked]:[&_span]:translate-x-2"
            checked={formData.in_stock}
            onCheckedChange={(checked) => handleChange("in_stock", checked)}
            disabled={isSubmitting}
          />
          <div className="grid grow gap-2">
            <Label htmlFor={`${formId}-in-stock`}>
              In Stock{" "}
              <span className="font-normal text-muted-foreground text-xs leading-[inherit]">
                (Available)
              </span>
            </Label>
            <p
              className="text-muted-foreground text-xs"
              id={`${formId}-in-stock-description`}
            >
              Mark this product as available for purchase
            </p>
          </div>
        </div>

        {/* Stock Quantity - comp-28 pattern with React Aria NumberField */}
        <NumberField
          value={formData.stock_quantity ?? undefined}
          onChange={(val) => handleChange("stock_quantity", isNaN(val) ? null : val)}
          minValue={0}
          isDisabled={isSubmitting}
        >
          <div className="*:not-first:mt-2">
            <AriaLabel className="font-medium text-foreground text-sm">
              Stock Quantity
            </AriaLabel>
            <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50">
              <Button
                className="-ms-px flex aspect-square h-[inherit] items-center justify-center rounded-s-md border border-input bg-background text-muted-foreground/80 text-sm transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                slot="decrement"
              >
                <MinusIcon aria-hidden="true" size={16} />
              </Button>
              <AriaInput className="w-full grow bg-background px-3 py-2 text-center text-foreground tabular-nums" />
              <Button
                className="-me-px flex aspect-square h-[inherit] items-center justify-center rounded-e-md border border-input bg-background text-muted-foreground/80 text-sm transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                slot="increment"
              >
                <PlusIcon aria-hidden="true" size={16} />
              </Button>
            </Group>
            <p className="text-muted-foreground text-xs">
              Optional. Leave empty if you don&apos;t track inventory.
            </p>
          </div>
        </NumberField>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <ShadButton type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {mode === "create" ? "Create Product" : "Save Changes"}
        </ShadButton>
        <ShadButton
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
          disabled={isSubmitting}
        >
          Cancel
        </ShadButton>
      </div>
    </form>
  );
}
