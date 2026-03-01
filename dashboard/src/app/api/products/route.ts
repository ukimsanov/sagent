import { NextRequest, NextResponse } from "next/server";
import { getDB, getProducts, createProduct, getCategories, saveProductVariants } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { triggerEmbeddingsBackground } from "@/lib/worker-proxy";

/**
 * GET /api/products
 * List products with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const inStockParam = searchParams.get("inStock");
    const inStock = inStockParam === "true" ? true : inStockParam === "false" ? false : undefined;

    const { products, total } = await getProducts(db, businessId, {
      limit,
      offset,
      search,
      category,
      inStock,
    });

    // Also fetch categories for filter dropdown
    const categories = await getCategories(db, businessId);

    return NextResponse.json({
      products,
      total,
      categories,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Products list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const body = await request.json() as {
      name?: string;
      description?: string;
      price?: number | string;
      currency?: string;
      category?: string;
      in_stock?: boolean | number;
      stock_quantity?: number | string;
      metadata?: Record<string, unknown>;
      image_urls?: string[];
      variants?: Array<{
        size?: string | null;
        color?: string | null;
        sku?: string | null;
        stock_quantity?: number;
        price_override?: number | null;
      }>;
    };

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const product = await createProduct(db, {
      business_id: businessId,
      name: body.name.trim(),
      description: body.description || null,
      price: body.price !== undefined ? Number(body.price) : null,
      currency: body.currency || "USD",
      category: body.category || null,
      in_stock: body.in_stock !== undefined ? (body.in_stock ? 1 : 0) : 1,
      stock_quantity: body.stock_quantity !== undefined ? Number(body.stock_quantity) : null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      image_urls: body.image_urls || [],
    });

    // Save variants if provided
    if (body.variants && body.variants.length > 0) {
      await saveProductVariants(db, product.id, body.variants);
      product.variants = body.variants.map((v, i) => ({
        id: `var-temp-${i}`,
        product_id: product.id,
        size: v.size ?? null,
        color: v.color ?? null,
        sku: v.sku ?? null,
        stock_quantity: v.stock_quantity ?? 0,
        price_override: v.price_override ?? null,
        position: i,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      }));
    }

    // Trigger embedding regeneration in background (non-blocking)
    triggerEmbeddingsBackground(businessId);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product create error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
