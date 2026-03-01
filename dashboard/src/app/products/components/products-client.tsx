"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, List, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProductCard } from "./product-card";
import { ProductTable } from "./product-table";
import { ImportExportButtons } from "./import-export";
import { SyncSearchButton } from "./sync-search-button";
import type { ProductWithImages } from "@/lib/db";

interface ProductsClientProps {
  initialProducts: ProductWithImages[];
  categories: string[];
}

export function ProductsClient({
  initialProducts,
  categories,
}: ProductsClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
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
    } catch (error) {
      // Revert optimistic update
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, in_stock: inStock ? 0 : 1 } : p
        )
      );
      console.error("Failed to update stock status:", error);
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

      // Refresh server data
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // Revert optimistic update
      setProducts((prev) => [...prev, ...deletedProducts]);
      console.error("Failed to delete products:", error);
    }
  };

  const handleDeleteSingle = (productId: string) => {
    handleDelete([productId]);
  };

  // Empty state
  if (products.length === 0) {
    return (
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
    );
  }

  return (
    <Tabs defaultValue="grid" className="space-y-4">
      {/* Toolbar with view toggle */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4">
            {/* View Toggle using Tabs */}
            <TabsList>
              <TabsTrigger value="grid" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <List className="h-4 w-4" />
                Table
              </TabsTrigger>
            </TabsList>

            {/* Sync + Import/Export + Add Product */}
            <div className="flex items-center gap-2">
              <SyncSearchButton />
              <ImportExportButtons />
              <Button asChild>
                <Link href="/products/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid View */}
      <TabsContent value="grid" className="mt-0">
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          style={{ transform: "translateZ(0)", WebkitBackfaceVisibility: "hidden" }}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onToggleStock={handleToggleStock}
              onDelete={handleDeleteSingle}
              isUpdating={updatingId === product.id}
            />
          ))}
        </div>
      </TabsContent>

      {/* Table View */}
      <TabsContent value="table" className="mt-0">
        <ProductTable
          products={products}
          categories={categories}
          onToggleStock={handleToggleStock}
          onDelete={handleDelete}
          updatingId={updatingId}
        />
      </TabsContent>
    </Tabs>
  );
}
