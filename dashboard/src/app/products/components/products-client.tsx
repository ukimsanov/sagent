"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { LayoutGrid, List, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProductCard } from "./product-card";
import { ProductTable } from "./product-table";
import type { ProductWithImages } from "@/lib/db";
import { toast } from "sonner";

interface ProductsClientProps {
  initialProducts: ProductWithImages[];
  categories: string[];
}

export function ProductsClient({
  initialProducts,
  categories,
}: ProductsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleToggleStock = async (productId: string, inStock: boolean) => {
    setUpdatingId(productId);

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, in_stock: inStock ? 1 : 0 } : p
      )
    );

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ in_stock: inStock ? 1 : 0 }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      toast.success(inStock ? "Product marked as in stock" : "Product marked as out of stock");
    } catch (error) {
      // Revert optimistic update
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, in_stock: inStock ? 0 : 1 } : p
        )
      );
      toast.error("Failed to update stock status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (productIds: string[]) => {
    // Optimistic update
    const deletedProducts = products.filter((p) => productIds.includes(p.id));
    setProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));

    try {
      // Delete one by one (could be batched in future)
      await Promise.all(
        productIds.map((id) =>
          fetch(`/api/products/${id}`, { method: "DELETE" })
        )
      );

      toast.success(
        productIds.length === 1
          ? "Product deleted"
          : `${productIds.length} products deleted`
      );

      // Refresh server data
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // Revert optimistic update
      setProducts((prev) => [...prev, ...deletedProducts]);
      toast.error("Failed to delete products");
    }
  };

  const handleDeleteSingle = (productId: string) => {
    handleDelete([productId]);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4">
            {/* View Toggle */}
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => value && setView(value as "grid" | "table")}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem
                value="grid"
                aria-label="Grid view"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Grid
              </ToggleGroupItem>
              <ToggleGroupItem
                value="table"
                aria-label="Table view"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3"
              >
                <List className="h-4 w-4 mr-2" />
                Table
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Add Product - only show in grid view (table has its own button) */}
            {view === "grid" && (
              <Button asChild>
                <Link href="/products/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Display */}
      <AnimatePresence mode="wait">
        {products.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">No products yet</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Start by adding your first product to the catalog.
                    </p>
                  </div>
                  <Button asChild className="mt-2">
                    <Link href="/products/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Product
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : view === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            style={{ transform: "translateZ(0)" }} // Safari GPU acceleration
          >
            <AnimatePresence mode="popLayout">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onToggleStock={handleToggleStock}
                  onDelete={handleDeleteSingle}
                  isUpdating={updatingId === product.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ transform: "translateZ(0)" }} // Safari GPU acceleration
          >
            <ProductTable
              products={products}
              categories={categories}
              onToggleStock={handleToggleStock}
              onDelete={handleDelete}
              updatingId={updatingId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
