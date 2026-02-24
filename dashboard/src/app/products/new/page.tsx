import { getDB, getCategories } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { ProductForm } from "../components/product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { user } = await withAuth();

  if (!user) {
    redirect("/auth/login");
  }

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);
  const categories = await getCategories(db, businessId);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center gap-4">
          <Link
            href="/products"
            className="flex items-center justify-center size-9 rounded-md border border-input bg-background hover:bg-accent transition-colors"
          >
            <ArrowLeftIcon className="size-4" />
            <span className="sr-only">Back to products</span>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Add New Product
            </h1>
            <p className="text-muted-foreground">
              Create a new product for your catalog
            </p>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div className="max-w-2xl">
          <ProductForm categories={categories} mode="create" />
        </div>
      </BlurFade>
    </div>
  );
}
