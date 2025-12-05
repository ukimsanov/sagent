import { getDB, getProducts, getCategories } from "@/lib/db";
import { getUserBusinessId } from "@/lib/auth-utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { ProductsClient } from "./components/products-client";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  // Check authentication
  const { user } = await withAuth();
  if (!user) {
    redirect("/auth/login");
  }

  const db = await getDB();
  const businessId = await getUserBusinessId(db, user.id);

  // Fetch products and categories
  const { products } = await getProducts(db, businessId, {});
  const categories = await getCategories(db, businessId);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalog ({products.length} products)
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Products content with view toggle */}
      <BlurFade delay={0.1}>
        <ProductsClient
          initialProducts={products}
          categories={categories}
        />
      </BlurFade>
    </div>
  );
}
