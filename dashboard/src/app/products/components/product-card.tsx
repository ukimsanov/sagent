"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { MoreHorizontal, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductWithImages } from "@/lib/db";

interface ProductCardProps {
  product: ProductWithImages;
  onToggleStock: (productId: string, inStock: boolean) => void;
  onDelete: (productId: string) => void;
  isUpdating?: boolean;
}

export function ProductCard({
  product,
  onToggleStock,
  onDelete,
  isUpdating,
}: ProductCardProps) {
  const hasImage = product.image_urls.length > 0;
  const imageUrl = hasImage ? product.image_urls[0] : null;
  const isInStock = product.in_stock === 1;

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group relative bg-card rounded-lg border border-border overflow-hidden"
      style={{ transform: "translateZ(0)" }} // Safari GPU acceleration
    >
      {/* Image Container */}
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-4/3 bg-muted overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}

          {/* Stock Badge Overlay */}
          <div className="absolute top-2 left-2">
            <Badge
              variant={isInStock ? "default" : "secondary"}
              className={`text-[10px] font-medium ${
                isInStock
                  ? "bg-emerald-500/90 hover:bg-emerald-500/90 text-white"
                  : "bg-zinc-500/90 hover:bg-zinc-500/90 text-white"
              }`}
            >
              {isInStock ? "In Stock" : "Out of Stock"}
            </Badge>
          </div>

          {/* Actions Menu */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 bg-white/90 hover:bg-white shadow-sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href={`/products/${product.id}`} className="cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(product.id)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Category */}
        {product.category && (
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {product.category}
          </span>
        )}

        {/* Title */}
        <Link href={`/products/${product.id}`} className="block">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">
            {formatPrice(product.price, product.currency)}
          </span>

          {/* Quick Stock Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stock</span>
            <Switch
              checked={isInStock}
              onCheckedChange={(checked) => onToggleStock(product.id, checked)}
              disabled={isUpdating}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>

        {/* Variant Sizes / Stock Quantity */}
        {product.variants && product.variants.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {[...new Set(product.variants.map((v) => v.size).filter(Boolean))].map(
              (size) => {
                const totalStock = product.variants
                  .filter((v) => v.size === size)
                  .reduce((sum, v) => sum + v.stock_quantity, 0);
                return (
                  <Badge
                    key={size}
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      totalStock === 0 ? "opacity-40 line-through" : ""
                    }`}
                  >
                    {size}
                  </Badge>
                );
              }
            )}
          </div>
        ) : product.stock_quantity !== null ? (
          <p className="text-xs text-muted-foreground">
            {product.stock_quantity} units available
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
